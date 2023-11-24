import { pipeline, env } from '@xenova/transformers';

export class FeatureExtractionPipelineClass {
  static task = "feature-extraction";
  static model = "Xenova/bge-large-en-v1.5";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      // NOTE: Uncomment this to change the cache directory
      // env.cacheDir = './public';

      // Specify a custom location for models (defaults to '/models/').
      env.localModelPath = './public';
      env.allowRemoteModels = false;
      console.log(env.localModelPath);
      this.instance = pipeline(this.task, this.model, { progress_callback });
      console.log(this.instance);
    }

    return this.instance;
  }
}