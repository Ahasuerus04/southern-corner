CREATE INDEX "track_title" ON "tracks" USING btree ("title");--> statement-breakpoint
CREATE INDEX "track_artist" ON "tracks" USING btree ("artist");--> statement-breakpoint
CREATE INDEX "track_genre" ON "tracks" USING btree ("genre");--> statement-breakpoint
CREATE INDEX "track_downloads" ON "tracks" USING btree ("download_count");