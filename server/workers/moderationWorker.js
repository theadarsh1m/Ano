const { parentPort } = require('worker_threads');
const tf = require('@tensorflow/tfjs');
const nsfw = require('nsfwjs');
const jpeg = require('jpeg-js');
const axios = require('axios');

let model = null;
let isModelLoading = false;

async function getModel() {
  if (model) return model;
  if (isModelLoading) {
    while (isModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return model;
  }

  isModelLoading = true;
  try {
    model = await nsfw.load();
    console.log('Worker Thread: NSFW model loaded successfully');
    parentPort.postMessage({ type: 'ready' });
  } catch (err) {
    console.error('Worker Thread: Failed to load NSFW model:', err);
    parentPort.postMessage({ type: 'error', error: `Model loading failed: ${err.message}` });
  } finally {
    isModelLoading = false;
  }
  return model;
}

function getJpegUrl(url) {
  if (!url) return null;
  return url.replace(/\.(png|webp|gif|jpeg|svg)$/i, '.jpg');
}

parentPort.on('message', async (msg) => {
  if (msg.type === 'scan') {
    const { jobId, imageUrl } = msg;
    try {
      const activeModel = await getModel();
      if (!activeModel) {
        throw new Error('Model is not initialized in worker thread');
      }

      console.log(`Worker Thread: Starting scan for image: ${imageUrl}`);
      const jpegUrl = getJpegUrl(imageUrl);
      const response = await axios.get(jpegUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      const rawImageData = jpeg.decode(buffer);
      const { width, height, data } = rawImageData;

      const bufferRGB = new Float32Array(width * height * 3);
      let offset = 0;
      for (let i = 0; i < data.length; i += 4) {
        bufferRGB[offset++] = data[i];     // R
        bufferRGB[offset++] = data[i + 1]; // G
        bufferRGB[offset++] = data[i + 2]; // B
      }

      const tensor = tf.tensor3d(bufferRGB, [height, width, 3], 'int32');
      const predictions = await activeModel.classify(tensor);
      tensor.dispose();

      let nsfwProb = 0;
      predictions.forEach((p) => {
        if (['Porn', 'Sexy', 'Hentai'].includes(p.className)) {
          nsfwProb += p.probability;
        }
      });

      const isNSFW = nsfwProb >= 0.50;
      parentPort.postMessage({
        type: 'result',
        jobId,
        isNSFW,
        confidence: nsfwProb,
      });
    } catch (err) {
      console.error(`Worker Thread: Error scanning image for job ${jobId}:`, err.message);
      parentPort.postMessage({
        type: 'error',
        jobId,
        error: err.message,
      });
    }
  }
});

// Trigger initial model loading on boot
getModel().catch(err => console.error('Initial worker model load error:', err));
