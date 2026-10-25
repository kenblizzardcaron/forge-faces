// Build rules shared by build.js (Node) and the site (browser). Loads with no require or Node built-ins.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FaceBuild = factory();
})(this, function () {
  const MAX_BYTES = 8158;
  const RESERVED = ['subscribe', 'init', 'enter', 'exit', 'a_short', 'a_long', 'l_short', 'l_long',
    'tilt', 'tap', 'button', 'ble_rx', 'clock_minute', 'clock_hour'];
  const TERSER_OPTIONS = {
    mangle: { toplevel: true, reserved: RESERVED },
    compress: { toplevel: false },
    format: { comments: false },
  };

  const PROFILE_DEFAULTS = { hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1 };

  // Fills each local.json profile with the defaults; a missing name or unknown key throws.
  function fillProfiles(name, profiles) {
    return profiles.map((p, i) => {
      if (!p.name) throw new Error(`local.json: ${name} profiles[${i}] needs a name`);
      for (const key of Object.keys(p)) {
        if (key !== 'name' && !Object.hasOwn(PROFILE_DEFAULTS, key)) throw new Error(`local.json: ${name} profiles[${i}] has no setting "${key}"`);
      }
      return { name: p.name, ...PROFILE_DEFAULTS, ...p };
    });
  }

  // Swaps each setting into the face's `var settings = { ... };`; `profiles` replaces its list.
  // The boot `profile` index must land in the resulting list, or the face's cur() is undefined.
  function localize(src, name, overrides) {
    const { profiles, ...settings } = overrides;
    const re = /var profiles = \[[\s\S]*?\];/;
    if (profiles !== undefined && (!Array.isArray(profiles) || profiles.length === 0)) {
      throw new Error(`local.json: ${name} profiles must be a non-empty list`);
    }
    let out = src.replace(/var settings = \{[^}]*\}/, (literal) => {
      for (const [key, value] of Object.entries(settings)) {
        const keyRe = new RegExp(`\\b${key}: [^,}]+`);
        if (!keyRe.test(literal)) throw new Error(`local.json: ${name} has no setting "${key}"`);
        literal = literal.replace(keyRe, `${key}: ${JSON.stringify(value)}`);
      }
      return literal;
    });
    const hasList = re.test(src);
    let count = 0;
    if (profiles) {
      if (!hasList) throw new Error(`local.json: ${name} has no profiles list`);
      const list = JSON.stringify(fillProfiles(name, profiles));
      out = out.replace(re, () => `var profiles = ${list};`);
      count = profiles.length;
    } else if (hasList) {
      count = (src.match(re)[0].match(/\bname:/g) || []).length;
    }
    if (hasList) {
      const settingsLiteral = out.match(/var settings = \{[^}]*\}/);
      const picked = settingsLiteral && settingsLiteral[0].match(/\bprofile: ([^,}]+)/);
      const index = picked ? JSON.parse(picked[1]) : 0;
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        throw new Error(`local.json: ${name} profile ${index} is out of range (0..${count - 1})`);
      }
    }
    return out;
  }

  return { MAX_BYTES, RESERVED, TERSER_OPTIONS, PROFILE_DEFAULTS, fillProfiles, localize };
});
