import OpenAI from 'openai';
import { config } from '../config/env.js';

export class OpenAIServiceBase {
  protected client: OpenAI;
  
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
}