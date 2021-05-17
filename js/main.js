import API_KEY from './test.js';

Cesium.Ion.defaultAccessToken =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0NTY2YmFmMS1jZWE5LTQwOGUtYjBmYi0yNjUwYWQwYjdlZGYiLCJpZCI6NTYxMzUsImlhdCI6MTYyMTI2NTU4Mn0.wYUBK1Xn-L_QA6QGoy02mqNwL6MYSZCvNmd-ErjFyww';
// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Cesium.Viewer('cesiumContainer', {
	terrainProvider: Cesium.createWorldTerrain(),
	imageryProvider: new Cesium.TileMapServiceImageryProvider({
		url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
	}),
});

const BASE_URL = 'https://api.n2yo.com/rest/v1/satellite/';
let TLE = '';

async function searchSatellites(query) {
	// try {
	const resp = await fetch(
		`https://cors-anywhere.herokuapp.com/${BASE_URL}tle/${query}&apiKey=${API_KEY}`
	);
	const data = await resp.json();
	return data;
	// } catch (error) {
	// 	console.log(error.response);
	// }
}

async function setSatellite(id) {
	// searchSatellites(id).then();
	TLE = await searchSatellites(id);
	console.log(TLE);
}

setSatellite('48399');

// Give SatelliteJS the TLE's and a specific time.
// Get back a longitude, latitude, height (km).
// We're going to generate a position every 10 seconds from now until 6 seconds from now.
const totalSeconds = 60 * 60 * 6;
const timeStepInSeconds = 10;
const start = Cesium.JulianDate.fromDate(new Date());
const stop = Cesium.JulianDate.addSeconds(
	start,
	totalSeconds,
	new Cesium.JulianDate()
);

viewer.scene.globe.enableLighting = true;
viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.timeline.zoomTo(start, stop);
viewer.clock.multiplier = 40;
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;

const positionsOverTime = new Cesium.SampledPositionProperty();

function trackSatellite(satId) {
	// These 2 lines are published by NORAD and allow us to predict where
	const ISS_TLE = `1 25544U 98067A   21121.52590485  .00001448  00000-0  34473-4 0  9997
    2 25544  51.6435 213.5204 0002719 305.2287 173.7124 15.48967392281368`;

	// Initialize a satellite record
	const satrec = satellite.twoline2satrec(
		ISS_TLE.split('\n')[0].trim(),
		ISS_TLE.split('\n')[1].trim()
	);

	for (let i = 0; i < totalSeconds; i += timeStepInSeconds) {
		const time = Cesium.JulianDate.addSeconds(
			start,
			i,
			new Cesium.JulianDate()
		);
		const jsDate = Cesium.JulianDate.toDate(time);
		// Get the position of the satellite at the given date
		const positionAndVelocity = satellite.propagate(satrec, jsDate);
		const gmst = satellite.gstime(jsDate);
		const position = satellite.eciToGeodetic(
			positionAndVelocity.position,
			gmst
		);
		const { longitude, latitude, height } = position;

		const currentPos = Cesium.Cartesian3.fromRadians(
			longitude,
			latitude,
			height * 1000
		);
		positionsOverTime.addSample(time, currentPos);
	}
}

// trackSatellite('48399');

//  Visualize the satellite with a red dot
const satellitePoint = viewer.entities.add({
	position: positionsOverTime,
	point: {
		pixelSize: 5,
		color: Cesium.Color.RED,
	},
});

// Set the camera to follow the satellite
viewer.trackedEntity = satellitePoint;

// Wait for globe to load then zoom out
let initialized = false;

viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
	if (!initialized && viewer.scene.globe.tilesLoaded === true) {
		viewer.clock.shouldAnimate = true;
		initialized = true;
		viewer.scene.camera.zoomOut(7000000);
		document.querySelector('#loading').classList.toggle('disappear', true);
	}
});
