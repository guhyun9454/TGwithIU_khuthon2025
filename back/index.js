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
app.post('/user/login', (req, res) => {
    const id = req.body.id                         //로그인시 아이디
    const pw = req.body.pw                //로그인시 비밀번호
    console.log('로그인 요청:', { id: req.body.id });
    database.login(id, pw, (data, cookie) => {
        console.log('로그인 성공:', { 
            name: data.name, 
            id: data.id 
        });
        database.setSession(data.id, data.name, cookie)

        //  login
        request.post({
            url: 'https://libseat.khu.ac.kr/login_library',
            followAllRedirects: false,
            form: {
                STD_ID: data.id
            },
            headers: {
                'User-Agent': 'request',
                Cookie: cookie
            }
        }, function(err, result, body) {
            if (err) {
                console.log('lib login err', err)
                res.status(400).json({
                    ok: false,
                    err: err
                })
                return
            }

            database.setSession2(data.id, result.headers['set-cookie'])

            res.json({
                ok: true,
                name: data.name,
                id: data.id,
                cookie: cookie
            })
        })
    },
    (err) => {
        res.status(400).json({
            ok: false,
            err: err
        })
    })
    
})

app.get('/stop/:stationId/eta', (req, res) => {
    const stationId = req.params.stationId;
    console.log('정류장 도착 정보 요청:', { 
        stationId: req.params.stationId,
        stationName: database.stationMap[req.params.stationId] 
    });
    database.getBusArrival(stationId, 
        (data) => {
            console.log('정류장 도착 정보 응답:', { 
                stationId: req.params.stationId,
                stationName: database.stationMap[req.params.stationId],
                data: data
            });
            res.json(data);
        },
        (error) => {
            console.log('정류장 도착 정보 조회 실패:', error);
            res.status(400).json({
                ok: false,
                error: error
            });
        }
    );
});


app.get('/complain/:stationId/passedby', (req, res) => {
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
