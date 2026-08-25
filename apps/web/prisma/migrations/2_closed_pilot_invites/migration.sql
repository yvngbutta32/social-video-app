-- Bind closed-pilot invitations to the workspace that the invited client may access.
ALTER TABLE "invite_codes"
  ADD COLUMN "workspace_id" TEXT;

CREATE INDEX "invite_codes_workspace_id_idx"
  ON "invite_codes"("workspace_id");

ALTER TABLE "invite_codes"
  ADD CONSTRAINT "invite_codes_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
