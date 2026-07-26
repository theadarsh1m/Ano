import { useGLTF } from "@react-three/drei";
import { CHAMBER_CLASH_ASSETS } from "./chamberClashAssets";

export interface PreloadState {
  total: number;
  loaded: number;
  failed: number;
  progress: number;
  isReady: boolean;
  isError: boolean;
  failedAssets: string[];
}

type Listener = (state: PreloadState) => void;

class ChamberClashPreloader {
  private state: PreloadState = {
    total: Object.keys(CHAMBER_CLASH_ASSETS).length,
    loaded: 0,
    failed: 0,
    progress: 0,
    isReady: false,
    isError: false,
    failedAssets: [],
  };

  private listeners: Set<Listener> = new Set();
  private isPreloadingStarted = false;
  private assetProgress: Record<string, number> = {};

  public getState(): PreloadState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public async startPreload() {
    if (this.state.isReady) {
      this.notify();
      return;
    }

    if (this.isPreloadingStarted && !this.state.isError) {
      return;
    }

    this.isPreloadingStarted = true;
    this.state.isError = false;
    this.state.failed = 0;
    this.state.failedAssets = [];
    this.notify();

    const assetEntries = Object.entries(CHAMBER_CLASH_ASSETS);
    this.state.total = assetEntries.length;

    // 1. Trigger useGLTF.preload for Drei cache population
    assetEntries.forEach(([_, url]) => {
      try {
        useGLTF.preload(url);
      } catch (err) {
        console.warn(`[PRELOADER] useGLTF.preload warning for ${url}:`, err);
      }
    });

    // 2. Fetch each asset with progress monitoring
    const loadPromises = assetEntries.map(async ([key, url]) => {
      try {
        await this.fetchAssetWithProgress(key, url);
        this.state.loaded += 1;
        this.updateProgress();
      } catch (err) {
        console.error(`[PRELOADER] Failed to preload asset ${key} (${url}):`, err);
        this.state.failed += 1;
        this.state.failedAssets.push(key);
        this.updateProgress();
      }
    });

    await Promise.all(loadPromises);

    if (this.state.loaded === this.state.total) {
      this.state.progress = 100;
      this.state.isReady = true;
      this.state.isError = false;
    } else {
      this.state.isError = true;
      this.state.isReady = false;
      this.isPreloadingStarted = false; // Allow retry
    }

    this.notify();
  }

  private fetchAssetWithProgress(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";

      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const ratio = event.loaded / event.total;
          this.assetProgress[key] = ratio;
          this.updateProgress();
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          this.assetProgress[key] = 1;
          this.updateProgress();
          resolve();
        } else {
          reject(new Error(`HTTP error ${xhr.status} loading ${url}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error(`Network error loading ${url}`));
      };

      xhr.send();
    });
  }

  private updateProgress() {
    const totalAssets = this.state.total;
    if (totalAssets === 0) return;

    let sumRatios = 0;
    Object.values(this.assetProgress).forEach((r) => {
      sumRatios += r;
    });

    const percent = Math.min(99, Math.floor((sumRatios / totalAssets) * 100));
    if (this.state.loaded < totalAssets) {
      this.state.progress = Math.max(this.state.progress, percent);
    }
    this.notify();
  }

  public retry() {
    this.isPreloadingStarted = false;
    this.startPreload();
  }
}

export const chamberClashPreloader = new ChamberClashPreloader();
