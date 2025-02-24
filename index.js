const gpxParser = require("gpxparser");

const exiftool = require("node-exiftool");
const exiftoolBin = require("dist-exiftool");

const fs = require("fs");
const path = require("path");
const args = require("args");
const moment = require("moment");

args
  .option("gpxFile", "The name of the GPX file")
  .option("inDir", "The name of the directory with photos to be edited", "in")
  .option(
    "outDir",
    "The name of the output directory with photos to be edited",
    "out"
  );

const {
  gpxFile: gpxFilefromArgs,
  inDir: inDirFromArgs,
} = args.parse(process.argv);

const ep = new exiftool.ExiftoolProcess(exiftoolBin);

const cwd = process.cwd();

console.log(cwd)

const inDir = path.join(cwd, inDirFromArgs);
const gpxFile = path.join(cwd, gpxFilefromArgs);

const gpx = new gpxParser();
gpx.parse(fs.readFileSync(gpxFile).toString());

const photoFileNames = fs.readdirSync(inDir).filter(fileName => fileName.toLowerCase().endsWith('.jpg'));

for (const photoFileName of photoFileNames) {
  ep.open()
    // read and write metadata operations
    .then(() => ep.readMetadata(path.join(inDir, photoFileName), ["-File:all"]))
    .then((metadata) => {
      process.stdout.write(JSON.stringify(metadata))
      const takenAt = moment(
        metadata.data[0].DateTimeOriginal,
        "YYYY:MM:DD hh:mm:ss"
      );

      const location = gpx.tracks[0].points.find((point) =>
        moment(point.time).isAfter(takenAt)
      );

      if (!location) {
        return Promise.reject('Could not find location for image: ', photoFileName)
      }

      return location
    }, console.error)
    .then((location) =>
      ep.writeMetadata(path.join(inDir, photoFileName), {
        GPSLatitude: location.lat,
        GPSLatitudeRef: location.lat > 0 ? "N" : "S",
        GPSLongitude: location.lon,
        GPSLongitudeRef: location.lon > 0 ? "E" : "W",
      })
    )
    .then(() => ep.close())
    .catch(console.error)
}
