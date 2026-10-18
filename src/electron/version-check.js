const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/;

function parseVersion(version) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) return null;
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? Number.POSITIVE_INFINITY : Number(match[4]),
  ];
}

function compareParsedVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  }
  return 0;
}

function newestRelease(releases, currentVersion) {
  const current = parseVersion(currentVersion);
  if (!current) throw new Error("应用版本号不符合发布约定。");

  let selected = null;
  for (const release of releases) {
    if (release.draft) continue;
    const match = /^v(.+)$/.exec(release.tag_name);
    if (!match) continue;
    const parsed = parseVersion(match[1]);
    if (!parsed || compareParsedVersions(parsed, current) <= 0) continue;
    if (!selected || compareParsedVersions(parsed, selected.parsed) > 0) {
      selected = {
        parsed,
        version: match[1],
        url: "https://github.com/Ganzhib/taoqi-pet/releases/tag/" + release.tag_name,
      };
    }
  }
  return selected && { version: selected.version, url: selected.url };
}

module.exports = { newestRelease, parseVersion };
