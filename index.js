const influx = require('@influxdata/influxdb-client');
const config = require('config');
const axios = require('axios');

const INFLUX_URL = config.get('Influx.Url');
const INFLUX_TOKEN = config.get('Influx.Token');
const INFLUX_ORG = config.get('Influx.Org');
const INFLUX_BUCKET = config.get('Influx.Bucket');

const writeApi = new influx.InfluxDB({url: INFLUX_URL, token: INFLUX_TOKEN}).getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ms')

const FRONIUS_HOST = config.get('Fronius.Host');

console.log(`Fetching data from ${FRONIUS_HOST} to ${INFLUX_URL} (${INFLUX_ORG}/${INFLUX_BUCKET}) -> ${INFLUX_TOKEN}`);

function roundFloat(data) {
    const float = parseFloat(data);
    return isNaN(float) ? 0 : float.toFixed(3);
}

async function pushData() {
    const powerFlow = await axios.get(`http://${FRONIUS_HOST}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`);
    const commonInverter = await axios.get(`http://${FRONIUS_HOST}/solar_api/v1/GetInverterRealtimeData.cgi?Scope=Device&DataCollection=CommonInverterData`);
    const powerMeter = await axios.get(`http://${FRONIUS_HOST}/solar_api/v1/GetMeterRealtimeData.cgi`);

    const powerFlowData = powerFlow.data.Body.Data.Site;
    const powerFlowPoint = new influx.Point('powerflow')
        .floatField('P_Akku', roundFloat(powerFlowData.P_Akku))
        .floatField('P_Grid', roundFloat(powerFlowData.P_Grid))
        .floatField('P_Load', roundFloat(powerFlowData.P_Load))
        .floatField('P_PV', roundFloat(powerFlowData.P_PV))
        .floatField('rel_autonomy', roundFloat(powerFlowData.rel_Autonomy))
        .floatField('rel_self', roundFloat(powerFlowData.rel_SelfConsumption));
    writeApi.writePoint(powerFlowPoint);

    const commonInverterData = commonInverter.data.Body.Data;
    const commonInverterPoint = new influx.Point('commoninverter')
        .floatField('IDC1', roundFloat(commonInverterData.IDC.Value))
        .floatField('IDC2', roundFloat(commonInverterData.IDC_2.Value))
        .floatField('UDC1', roundFloat(commonInverterData.UDC.Value))
        .floatField('UDC2', roundFloat(commonInverterData.UDC_2.Value))
        .floatField('IAC', roundFloat(commonInverterData.IAC.Value))
        .floatField('PAC', roundFloat(commonInverterData.PAC.Value))
        .floatField('UAC', roundFloat(commonInverterData.UAC.Value));
    writeApi.writePoint(commonInverterPoint);

    const powerMeterData = powerMeter.data.Body.Data["0"];
    const powerMeterPoint = new influx.Point('powermeter')
        .floatField('IAC1', roundFloat(powerMeterData.Current_AC_Phase_1))
        .floatField('IAC2', roundFloat(powerMeterData.Current_AC_Phase_2))
        .floatField('IAC3', roundFloat(powerMeterData.Current_AC_Phase_3))
        .floatField('IACSum', roundFloat(powerMeterData.Current_AC_Sum))
        .floatField('PF1', roundFloat(powerMeterData.PowerFactor_Phase_1))
        .floatField('PF2', roundFloat(powerMeterData.PowerFactor_Phase_2))
        .floatField('PF3', roundFloat(powerMeterData.PowerFactor_Phase_3))
        .floatField('PFSum', roundFloat(powerMeterData.PowerFactor_Sum))
        .floatField('VAC1', roundFloat(powerMeterData.Voltage_AC_Phase_1))
        .floatField('VAC2', roundFloat(powerMeterData.Voltage_AC_Phase_2))
        .floatField('VAC3', roundFloat(powerMeterData.Voltage_AC_Phase_3))
        .floatField('S1', roundFloat(powerMeterData.PowerApparent_S_Phase_1))
        .floatField('S2', roundFloat(powerMeterData.PowerApparent_S_Phase_2))
        .floatField('S3', roundFloat(powerMeterData.PowerApparent_S_Phase_3))
        .floatField('SSum', roundFloat(powerMeterData.PowerApparent_S_Sum))
        .floatField('Q1', roundFloat(powerMeterData.PowerReactive_Q_Phase_1))
        .floatField('Q2', roundFloat(powerMeterData.PowerReactive_Q_Phase_2))
        .floatField('Q3', roundFloat(powerMeterData.PowerReactive_Q_Phase_3))
        .floatField('QSum', roundFloat(powerMeterData.PowerReactive_Q_Sum))
        .floatField('P1', roundFloat(powerMeterData.PowerReal_P_Phase_1))
        .floatField('P2', roundFloat(powerMeterData.PowerReal_P_Phase_2))
        .floatField('P3', roundFloat(powerMeterData.PowerReal_P_Phase_3))
        .floatField('PSum', roundFloat(powerMeterData.PowerReal_P_Sum))
        .floatField('FAvg', roundFloat(powerMeterData.Frequency_Phase_Average))
    writeApi.writePoint(powerMeterPoint);
    await writeApi.flush();
}

setInterval(async () => {
    try {
        await pushData();
    } catch(ex) {
        console.error(ex);
    }
}, 30 * 1000);