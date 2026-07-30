CREATE TABLE IF NOT EXISTS "outgoing_mails" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient" text NOT NULL,
  "subject" text NOT NULL,
  "html_content" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
