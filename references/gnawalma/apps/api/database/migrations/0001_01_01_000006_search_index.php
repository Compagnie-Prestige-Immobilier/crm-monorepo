<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // unaccent(regdictionary, text) est STABLE ; ce wrapper le déclare IMMUTABLE pour l'utiliser
        // dans une colonne générée / un index, comme le recommande la doc PostgreSQL.
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
                SELECT public.unaccent('public.unaccent', $1)
            $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        SQL);

        if (! DB::selectOne("SELECT 1 FROM pg_ts_config WHERE cfgname = 'french_unaccent'")) {
            DB::statement('CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french)');
            DB::statement(<<<'SQL'
                ALTER TEXT SEARCH CONFIGURATION french_unaccent
                ALTER MAPPING FOR word, hword, hword_part, asciiword, asciihword, hword_asciipart
                WITH unaccent, french_stem
            SQL);
        }

        DB::statement(<<<'SQL'
            ALTER TABLE ateliers ADD COLUMN search tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('french_unaccent', coalesce(name, '')), 'A') ||
                setweight(to_tsvector('french_unaccent', coalesce(region, '')), 'B') ||
                setweight(to_tsvector('french_unaccent', coalesce(specialties::text, '')), 'B') ||
                setweight(to_tsvector('french_unaccent', coalesce(address, '')), 'C') ||
                setweight(to_tsvector('french_unaccent', coalesce(description, '')), 'D')
            ) STORED
        SQL);

        // concat_ws() est STABLE (dépatch "any"), donc pas utilisable dans une colonne générée.
        DB::statement(<<<'SQL'
            ALTER TABLE ateliers ADD COLUMN search_text text GENERATED ALWAYS AS (
                f_unaccent(lower(
                    coalesce(name, '') || ' ' || coalesce(region, '') || ' ' ||
                    coalesce(address, '') || ' ' || coalesce(specialties::text, '')
                ))
            ) STORED
        SQL);

        DB::statement('CREATE INDEX ateliers_search_gin ON ateliers USING gin (search)');
        DB::statement('CREATE INDEX ateliers_search_text_trgm_gin ON ateliers USING gin (search_text gin_trgm_ops)');
        DB::statement('CREATE INDEX ateliers_name_trgm_gin ON ateliers USING gin (f_unaccent(lower(name)) gin_trgm_ops)');
        DB::statement('CREATE INDEX ateliers_region_trgm_gin ON ateliers USING gin (f_unaccent(lower(region)) gin_trgm_ops)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS ateliers_region_trgm_gin');
        DB::statement('DROP INDEX IF EXISTS ateliers_name_trgm_gin');
        DB::statement('DROP INDEX IF EXISTS ateliers_search_text_trgm_gin');
        DB::statement('DROP INDEX IF EXISTS ateliers_search_gin');
        DB::statement('ALTER TABLE ateliers DROP COLUMN IF EXISTS search_text');
        DB::statement('ALTER TABLE ateliers DROP COLUMN IF EXISTS search');
        DB::statement('DROP TEXT SEARCH CONFIGURATION IF EXISTS french_unaccent');
        DB::statement('DROP FUNCTION IF EXISTS f_unaccent(text)');
    }
};
