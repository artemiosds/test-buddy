# Plan - Fix Maintenance Mode Disable Error

The user is experiencing an error when trying to disable maintenance mode: "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect Supabase in Lovable Cloud."

This happens because the server-side code (TanStack Start server functions) is trying to use the Supabase Admin client, which requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be set in the environment variables (secrets). While `SUPABASE_URL` is in `.env`, it's not registered in the project's secret store, and `SUPABASE_SERVICE_ROLE_KEY` is missing.

## Proposed Changes

### 1. Register Supabase Secrets
- Use `secrets--add_secret` to ask the user to provide the `SUPABASE_SERVICE_ROLE_KEY`.
- Use `secrets--set_secret` to register `SUPABASE_URL` from the existing `.env` file into the project's secret store so it's available to server functions.

### 2. Update Environment Variable Usage
- Ensure `src/integrations/supabase/client.server.ts` correctly reads these variables. (Current code already looks for them, but they aren't provided by the environment yet).

## Technical Details
- The error message "Missing Supabase environment variable(s)" comes from `src/integrations/supabase/client.server.ts`.
- Server functions run in a context where `.env` files are not automatically loaded if they aren't in the platform's secret store.
- I will guide the user to connect Supabase or provide the Service Role Key.

## User Review Required
> [!IMPORTANT]
> I need you to provide the **Supabase Service Role Key**. This is a sensitive key found in your Supabase Project Settings > API.
