const express = require('express')
const app = express()
const cors = require('cors');                           //서버간 통신 모듈
app.use(cors())
const { DateTime } = require('luxon');
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))  


const PORT = 8081
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const database = require('./database/index')            //데이터베이스 파일 경로




const request = require('request')
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false }); // 배열을 단순화하는 옵션






//example
app.get('/example', (req, res) => {
    const stationId = req.params.stationId;
    const predictions = database.getStoredPredictionsByStation(stationId);
    console.log('민원/정차 기록 확인 요청:', { 
        stationId: req.params.stationId,
        stationName: database.stationMap[req.params.stationId] 
    });
    if (!predictions || predictions.length === 0) {
        res.status(404).json({
            ok: false,
            message: "저장된 값이 없습니다"
        });
        return;
    }
    res.json({
        ok: true,
        data: predictions
    });
});