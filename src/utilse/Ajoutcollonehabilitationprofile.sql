

DO $$
DECLARE 
    i INT;
    sql TEXT;
BEGIN
    FOR i IN 51..300 LOOP
        sql := format('ALTER TABLE public.habilitationprofile ADD COLUMN a%s boolean DEFAULT false;', i);
        EXECUTE sql;
    END LOOP;
END $$;
