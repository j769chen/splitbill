-- Enum types. Declared first because tables below reference them.

create type public.split_type as enum ('equal', 'exact', 'percentage');
