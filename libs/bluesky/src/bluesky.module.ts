import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlueskyClientService } from './bluesky-client.service';
import { JetstreamClientService } from './jetstream-client.service';
import { DidResolverService } from './did-resolver.service';
import { CursorPersistenceService } from './cursor-persistence.service';

@Module({
  imports: [ConfigModule],
  providers: [
    BlueskyClientService,
    JetstreamClientService,
    DidResolverService,
    CursorPersistenceService,
  ],
  exports: [
    BlueskyClientService,
    JetstreamClientService,
    DidResolverService,
    CursorPersistenceService,
  ],
})
export class BlueskyModule {}
