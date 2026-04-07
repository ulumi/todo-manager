module.exports = async function handler(req, res) {
  try {
    const { supabase } = require('./_supabase');
    const { data, error } = await supabase.from('presence').select('user_id').limit(1);
    res.status(200).json({ ok: true, env: !!process.env.SUPABASE_URL, data, error: error?.message });
  } catch (e) {
    res.status(200).json({ crash: e.message, stack: e.stack?.split('\n').slice(0, 5) });
  }
};
