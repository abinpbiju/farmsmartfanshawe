
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {BigQuery} = require('@google-cloud/bigquery');
const cors = require('cors')({ origin: true });

admin.initializeApp(functions.config().firebase);

const db = admin.database();
const bigquery = new BigQuery();

/**
 * Receive data from pubsub, then 
 * Write telemetry raw data to bigquery
 * Maintain last data on firebase realtime database
 */
exports.receiveTelemetry = functions.pubsub
  .topic('telemetry-topic')
  .onPublish((message, context) => {
    const attributes = message.attributes;
    const payload = message.json;

    const deviceId = attributes['deviceId'];

    const data = {
      humidity: payload.hum,
      temp: payload.temp,
      moisture: payload.mos,
      pumpstatus: payload.pumpstatus,
      deviceId: deviceId,
      timestamp: context.timestamp
    };

    if (
      payload.hum < 0 ||
      payload.hum > 100 ||
      payload.temp > 100 ||
      payload.temp < -50
    ) {
      // Validate and do nothing
      return;
    }

    return Promise.all([
      insertIntoBigquery(data),
      updateCurrentDataFirebase(data)
    ]);
  });

/** 
 * Maintain last status in firebase
*/
function updateCurrentDataFirebase(data) {
  return db.ref(`/devices/${data.deviceId}`).set({
    humidity: data.humidity,
    temp: data.temp,
    moisture: data.moisture,
    pumpstatus: data.pumpstatus,
    lastTimestamp: data.timestamp
  });
}

/**
 * Store all the raw data in bigquery
 */
function insertIntoBigquery(data) {
  // TODO: Make sure you set the `bigquery.datasetname` Google Cloud environment variable.
  const dataset = bigquery.dataset(functions.config().bigquery.datasetname);
  // TODO: Make sure you set the `bigquery.tablename` Google Cloud environment variable.
  const table = dataset.table(functions.config().bigquery.tablename);

  return table.insert(data);
}

