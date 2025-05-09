const fs = require('fs');
const path = require('path');
require('dotenv').config();//환경변수 설정
const serviceKey = process.env.API_KEY;
const xml2js2 = require('xml2js');
const JSEncrypt = require('node-jsencrypt');
const request = require('request');
const fs2 = require('fs').promises;
const { DateTime } = require('luxon');
const session=[];
const busArrival = {
    lastUpdate: null,
    currentData: {},  // stopId를 키로 사용
    updateIntervals: {}  // 각 정류장별 인터벌 저장
};

const busStationData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '버스정류소현황.json'), 'utf8')
);



module.exports = {
    
};


