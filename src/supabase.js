import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jvxqyfnsizgmymbqahzm.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2eHF5Zm5zaXpnbXltYnFhaHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODIwNDAsImV4cCI6MjA4OTg1ODA0MH0.oWGvC0hFBdayQFRaHLuu49tFYiaBnJfFHrWsJ1ylD_w"

export const supabase = createClient(supabaseUrl, supabaseKey)