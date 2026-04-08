CREATE TABLE `controls` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`img` text
);
--> statement-breakpoint
CREATE TABLE `pilot` (
	`id` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`email` text,
	`passwordHash` text NOT NULL,
	`role` text DEFAULT 'PILOT' NOT NULL,
	`token` text NOT NULL,
	`country` text DEFAULT 'un',
	`avatarUrl` text,
	`teamId` text,
	`vehicleId` text,
	`controlsId` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vehicleId`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`controlsId`) REFERENCES `controls`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_displayName_unique` ON `pilot` (`displayName`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_email_unique` ON `pilot` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_token_unique` ON `pilot` (`token`);--> statement-breakpoint
CREATE TABLE `race` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`racetrackId` text,
	`lapCount` integer DEFAULT 3 NOT NULL,
	`session` text DEFAULT 'Race' NOT NULL,
	`weather` text DEFAULT 'Clear' NOT NULL,
	`startType` text DEFAULT 'Grid Start' NOT NULL,
	`trackingMode` text DEFAULT 'manual' NOT NULL,
	`sessionMode` text DEFAULT 'laps' NOT NULL,
	`sessionDurationMs` integer,
	`teamDisplayMode` text DEFAULT 'color-bar' NOT NULL,
	`chronoDisplayMode` text DEFAULT 'gap' NOT NULL,
	`timingEnabled` integer DEFAULT true NOT NULL,
	`eventDuration` integer DEFAULT 5 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`racetrackId`) REFERENCES `racetrack`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `race_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`raceId` text NOT NULL,
	`pilotId` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`gridPosition` integer,
	`teamSnapshot` text,
	`vehicleSnapshot` text,
	`controlsSnapshot` text,
	FOREIGN KEY (`raceId`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pilotId`) REFERENCES `pilot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `race_state` (
	`raceId` text PRIMARY KEY NOT NULL,
	`pilotStates` text DEFAULT '{}' NOT NULL,
	`startedAt` text,
	`pausedAt` text,
	`totalPausedMs` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`raceId`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `racetrack` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`checkpoints` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `racetrack_name_unique` ON `racetrack` (`name`);--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`acronym` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_name_unique` ON `team` (`name`);--> statement-breakpoint
CREATE TABLE `vehicle` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`manufacturer` text,
	`model` text NOT NULL,
	`img` text
);
