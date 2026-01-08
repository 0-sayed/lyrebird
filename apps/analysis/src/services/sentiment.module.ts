import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BertSentimentService } from './bert-sentiment.service';

/**
 * Shared module for sentiment analysis services.
 * This module should be imported by any module requiring BertSentimentService
 * to ensure a single shared instance is used across the application.
 */
@Module({
  imports: [ConfigModule],
  providers: [BertSentimentService],
  exports: [BertSentimentService],
})
export class SentimentModule {}
