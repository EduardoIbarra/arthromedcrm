-- CreateTable: kanban_columns
CREATE TABLE IF NOT EXISTS "public"."kanban_columns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#0763a9',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "kanban_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: kanban_client_columns
CREATE TABLE IF NOT EXISTS "public"."kanban_client_columns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "kanban_client_columns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kanban_client_columns_client_id_key" UNIQUE ("client_id"),
    CONSTRAINT "kanban_client_columns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "kanban_client_columns_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "public"."kanban_columns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

-- CreateTable: kanban_history
CREATE TABLE IF NOT EXISTS "public"."kanban_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "from_column_id" UUID,
    "to_column_id" UUID NOT NULL,
    "from_column_name" TEXT,
    "to_column_name" TEXT NOT NULL,
    "moved_by" UUID,
    "moved_by_name" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "kanban_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kanban_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable: kanban_comments
CREATE TABLE IF NOT EXISTS "public"."kanban_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "author_id" UUID,
    "author_name" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "kanban_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kanban_comments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_kanban_client_columns_client_id" ON "public"."kanban_client_columns"("client_id");
CREATE INDEX IF NOT EXISTS "idx_kanban_client_columns_column_id" ON "public"."kanban_client_columns"("column_id");
CREATE INDEX IF NOT EXISTS "idx_kanban_history_client_id" ON "public"."kanban_history"("client_id");
CREATE INDEX IF NOT EXISTS "idx_kanban_comments_client_id" ON "public"."kanban_comments"("client_id");

-- Seed default columns
INSERT INTO "public"."kanban_columns" ("name", "position", "color")
VALUES
    ('Contacto', 0, '#6366f1'),
    ('Lead', 1, '#f59e0b'),
    ('Clientes', 2, '#10b981')
ON CONFLICT DO NOTHING;
