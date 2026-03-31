import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fmjlfndunqcvcjgeluhh.supabase.co";
const supabaseAnonKey = "sb_publishable_JBrlE4mcDn6bXZr0qNJ89w_ff0JT-ZI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

