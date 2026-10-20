const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/;
const RELEASE_TAG_LINK_PATTERN =
  /href="https:\/\/github\.com\/Ganzhib\/taoqi-pet\/releases\/tag\/(v[^"]+)"/g;

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

function isPreviewVersion(version) {
  if (!parseVersion(version)) throw new Error("应用版本号不符合发布约定。");
  return version.includes("-preview.");
}

function updateChannel(version) {
  return isPreviewVersion(version) ? "preview" : "latest";
}

function configureUpdaterChannel(updater, channel) {
  updater.channel = channel;
  updater.allowPrerelease = channel === "preview";
  // electron-updater 会在设置 channel 时重新允许降级，必须在它之后关闭。
  updater.allowDowngrade = false;
}

function releasesFromAtom(feed) {
  const releases = [];
  const seen = new Set();
  for (const match of feed.matchAll(RELEASE_TAG_LINK_PATTERN)) {
    const tag = match[1];
    const version = tag.slice(1);
    if (seen.has(tag) || !parseVersion(version)) continue;
    seen.add(tag);
    releases.push({
      tag_name: tag,
      draft: false,
      prerelease: isPreviewVersion(version),
    });
  }
  return releases;
}

function newestRelease(releases, currentVersion) {
  const current = parseVersion(currentVersion);
  if (!current) throw new Error("应用版本号不符合发布约定。");
  const acceptsPreview = isPreviewVersion(currentVersion);

  let selected = null;
  for (const release of releases) {
    if (release.draft) continue;
    const match = /^v(.+)$/.exec(release.tag_name);
    if (!match) continue;
    const parsed = parseVersion(match[1]);
    if (!parsed) continue;
    if (!acceptsPreview && (release.prerelease || isPreviewVersion(match[1]))) continue;
    if (compareParsedVersions(parsed, current) <= 0) continue;
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

function releaseDownloadUrl(version) {
  if (!parseVersion(version)) throw new Error("应用版本号不符合发布约定。");
  return "https://github.com/Ganzhib/taoqi-pet/releases/download/v" + version + "/";
}

module.exports = {
  configureUpdaterChannel,
  isPreviewVersion,
  newestRelease,
  parseVersion,
  releaseDownloadUrl,
  releasesFromAtom,
  updateChannel,
};
