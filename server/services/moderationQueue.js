const { Worker } = require('worker_threads');
const path = require('path');
const prisma = require('../db');

class ModerationQueue {
  constructor() {
    this.queue = [];
    this.isBusy = false;
    this.worker = null;
    this.io = null;
    this.activeJob = null;
    
    // Initialize the worker thread on boot
    this.initWorker();
  }

  setSocketIO(ioInstance) {
    this.io = ioInstance;
  }

  initWorker() {
    try {
      const workerPath = path.join(__dirname, '../workers/moderationWorker.js');
      this.worker = new Worker(workerPath);
      
      this.worker.on('message', (msg) => {
        this.handleWorkerMessage(msg);
      });

      this.worker.on('error', (err) => {
        console.error('Moderation worker thread error:', err);
        this.handleWorkerFailure(err.message);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`Moderation worker stopped with exit code ${code}. Restarting...`);
          this.initWorker();
        }
      });
    } catch (err) {
      console.error('Failed to initialize moderation worker:', err);
    }
  }

  extractPublicId(url) {
    if (!url) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/);
    return match ? match[1] : null;
  }

  async addJob(job) {
    // job shape: { type: 'POST'|'MESSAGE'|'DM', id: string, imageUrl: string, roomId?: string, conversationId?: string }
    if (!job.imageUrl) return;

    // 1. Check cache immediately on the main thread
    const publicId = this.extractPublicId(job.imageUrl);
    if (publicId) {
      try {
        const cached = await prisma.moderationCache.findUnique({
          where: { publicId }
        });
        if (cached) {
          console.log(`[Queue Cache Hit] Reusing moderation for publicId: ${publicId}`);
          await this.applyModerationResult(job, {
            status: cached.status,
            isNSFW: cached.isNSFW,
            nsfwConfidence: cached.nsfwConfidence
          });
          return;
        }
      } catch (err) {
        console.error('Failed to read moderation cache in queue:', err);
      }
    }

    // 2. Set database status to 'SCANNING' immediately
    await this.updateRecordStatus(job, 'SCANNING', false, 0);

    // 3. Queue the job
    this.queue.push(job);
    this.processNext();
  }

  async processNext() {
    if (this.isBusy || this.queue.length === 0) return;
    this.isBusy = true;
    
    this.activeJob = this.queue.shift();
    console.log(`[Queue] Starting scan job for ${this.activeJob.type} ID: ${this.activeJob.id}`);
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'scan',
        jobId: this.activeJob.id,
        imageUrl: this.activeJob.imageUrl
      });
    } else {
      console.warn('Moderation worker thread is not initialized. Rescheduling...');
      this.queue.unshift(this.activeJob);
      this.isBusy = false;
      setTimeout(() => this.processNext(), 1000);
    }
  }

  async handleWorkerMessage(msg) {
    if (msg.type === 'ready') {
      console.log('[Queue] Worker thread loaded model successfully');
      return;
    }

    if (msg.type === 'result') {
      const { jobId, isNSFW, confidence } = msg;
      if (!this.activeJob || this.activeJob.id !== jobId) return;

      const status = isNSFW ? 'FLAGGED' : 'APPROVED';
      console.log(`[Queue Job Success] Job ${jobId} finished. Status: ${status}`);

      // 1. Cache result
      const publicId = this.extractPublicId(this.activeJob.imageUrl);
      if (publicId) {
        await prisma.moderationCache.upsert({
          where: { publicId },
          update: { isNSFW, nsfwConfidence: confidence, status },
          create: { publicId, isNSFW, nsfwConfidence: confidence, status }
        }).catch(err => console.error('Failed to update cache:', err));
      }

      // 2. Apply result to DB and emit sockets
      await this.applyModerationResult(this.activeJob, { status, isNSFW, nsfwConfidence: confidence });

      this.isBusy = false;
      this.activeJob = null;
      this.processNext();
    } else if (msg.type === 'error') {
      const { jobId, error } = msg;
      console.error(`[Queue Job Error] Worker scanned failed for job ${jobId}:`, error);
      this.handleWorkerFailure(error);
    }
  }

  async handleWorkerFailure(errorMsg) {
    if (!this.activeJob) return;
    
    // Set to SCANNING_FAILED
    console.log(`[Queue] Marking job ${this.activeJob.id} as SCANNING_FAILED`);
    await this.updateRecordStatus(this.activeJob, 'SCANNING_FAILED', false, 0);

    // Broadcast status update
    this.broadcastStatus(this.activeJob, {
      status: 'SCANNING_FAILED',
      isNSFW: false,
      nsfwConfidence: 0
    });

    // Schedule retry logic after 10 seconds (standard automated retry)
    const failedJob = this.activeJob;
    setTimeout(() => {
      console.log(`[Queue] Retrying failed moderation job: ${failedJob.id}`);
      this.addJob(failedJob);
    }, 10000);

    this.isBusy = false;
    this.activeJob = null;
    this.processNext();
  }

  async applyModerationResult(job, result) {
    await this.updateRecordStatus(job, result.status, result.isNSFW, result.nsfwConfidence);
    this.broadcastStatus(job, result);
  }

  async updateRecordStatus(job, status, isNSFW, nsfwConfidence) {
    try {
      if (job.type === 'POST') {
        await prisma.post.update({
          where: { id: job.id },
          data: { moderationStatus: status, isNSFW, nsfwConfidence }
        });
      } else if (job.type === 'MESSAGE') {
        await prisma.message.update({
          where: { id: job.id },
          data: { moderationStatus: status, isNSFW, nsfwConfidence }
        });
      } else if (job.type === 'DM') {
        await prisma.directMessage.update({
          where: { id: job.id },
          data: { moderationStatus: status, isNSFW, nsfwConfidence }
        });
      }
    } catch (err) {
      console.error(`Failed to update DB record for job ${job.id} type ${job.type}:`, err);
    }
  }

  broadcastStatus(job, result) {
    if (!this.io) return;
    
    if (job.type === 'POST') {
      this.io.emit('post_moderated', {
        postId: job.id,
        moderationStatus: result.status,
        isNSFW: result.isNSFW,
        nsfwConfidence: result.nsfwConfidence
      });
    } else if (job.type === 'MESSAGE') {
      this.io.to(job.roomId).emit('message_moderated', {
        messageId: job.id,
        roomId: job.roomId,
        moderationStatus: result.status,
        isNSFW: result.isNSFW,
        nsfwConfidence: result.nsfwConfidence
      });
    } else if (job.type === 'DM') {
      this.io.to(`dm_${job.conversationId}`).emit('dm_moderated', {
        messageId: job.id,
        conversationId: job.conversationId,
        moderationStatus: result.status,
        isNSFW: result.isNSFW,
        nsfwConfidence: result.nsfwConfidence
      });
    }
  }
}

module.exports = new ModerationQueue();
