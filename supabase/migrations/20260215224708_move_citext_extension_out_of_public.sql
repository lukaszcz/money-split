-- Move citext extension objects out of the public schema to satisfy lint/security guidance.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
ALTER EXTENSION citext SET SCHEMA extensions;
