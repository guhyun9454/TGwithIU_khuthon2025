import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'dart:async';

class MainScreen extends StatefulWidget {
  @override
  _MainScreenState createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  late VideoPlayerController _controller;
  bool isVideoInitialized = false;
  String statusMessage = "이상이 없습니다.";
  List<String> logMessages = ["이상이 없습니다."]; // 로그 메시지 리스트
  String currentTime = "";

  @override
  void initState() {
    super.initState();
    _initializeVideo();
    _updateTime();
  }

  void _initializeVideo() async {
    try {
      _controller = VideoPlayerController.asset('assets/videos/2.mp4')
        ..initialize().then((_) {
          setState(() {
            isVideoInitialized = true;
            _controller.play();
          });
        }).catchError((error) {
          print("❌ Video load error: $error");
        });
    } catch (e) {
      print("❌ Initialization Error: $e");
    }
  }

  void _updateTime() {
    Timer.periodic(Duration(seconds: 1), (timer) {
      setState(() {
        currentTime = _formattedCurrentTime();
      });
    });
  }

  String _formattedCurrentTime() {
    final now = DateTime.now();
    return "${now.year}/${_twoDigits(now.month)}/${_twoDigits(now.day)} "
        "${_twoDigits(now.hour)}:${_twoDigits(now.minute)}:${_twoDigits(now.second)}";
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    setState(() {
      _controller.value.isPlaying ? _controller.pause() : _controller.play();
    });
  }

  void _rewind() {
    if (isVideoInitialized) {
      final currentPosition = _controller.value.position;
      final rewindPosition = currentPosition - Duration(seconds: 10);
      _controller.seekTo(
          rewindPosition >= Duration.zero ? rewindPosition : Duration.zero);
    }
  }

  void _addLog(String message) {
    setState(() {
      statusMessage = message;
      logMessages.insert(0, message);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Text(
          'CCTV',
          style: TextStyle(
            color: const Color.fromARGB(255, 65, 65, 65),
            fontSize: 25,
            fontWeight: FontWeight.w500,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Image.asset(
              'assets/person.png',
              width: 30,
              height: 30,
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Column(
          children: [
            SizedBox(height: 10), // CCTV 타이틀과 영상 사이 여백
            if (isVideoInitialized)
              AspectRatio(
                aspectRatio: _controller.value.aspectRatio,
                child: VideoPlayer(_controller),
              )
            else
              CircularProgressIndicator(),

            SizedBox(height: 10),

            // 실시간 시간 표시 (오른쪽 정렬)
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                currentTime,
                style: TextStyle(
                  fontSize: 15,
                  color: Colors.black54,
                ),
              ),
            ),

            SizedBox(height: 15),

            // Play/Pause 및 뒤로 감기 버튼 (가운데 정렬)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: _rewind,
                  icon: Icon(Icons.replay_10, size: 35, color: Colors.black54),
                ),
                SizedBox(width: 20),
                InkWell(
                  onTap: _togglePlayPause,
                  child: Container(
                    width: 65,
                    height: 65,
                    decoration: BoxDecoration(
                      color: Color(0xFF27B155),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.15),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    child: Icon(
                      _controller.value.isPlaying
                          ? Icons.pause
                          : Icons.play_arrow,
                      color: Colors.white,
                      size: 35,
                    ),
                  ),
                ),
                SizedBox(width: 70),
              ],
            ),

            SizedBox(height: 10),

            // 상태 메시지 (왼쪽 정렬)
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '상태',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 25,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            // 상태 메시지 로그 박스 (높이 300으로 제한)
            SizedBox(
              height: 390, // 높이를 300으로 제한
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(vertical: 10),
                padding: const EdgeInsets.all(12.0),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Color(0xFFE1E1E1)),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x3F000000),
                      blurRadius: 4,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: ListView.builder(
                  padding: const EdgeInsets.all(8.0),
                  itemCount: logMessages.length,
                  itemBuilder: (context, index) {
                    bool isSafe =
                        logMessages[index].trim().contains("이상이 없습니다.");
                    return Container(
                      margin: EdgeInsets.only(bottom: 8),
                      padding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Color(0xFFDFDFDF)),
                        borderRadius: BorderRadius.circular(22),
                        color: isSafe
                            ? Color(0xFF27B155).withOpacity(0.1)
                            : Color(0xFFD50000).withOpacity(0.1),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 60,
                            height: 35,
                            decoration: BoxDecoration(
                              color: isSafe
                                  ? Color(0xFF27B155)
                                  : Color(0xFFD50000),
                              borderRadius: BorderRadius.circular(15),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              isSafe ? "안전" : "경고",
                              style:
                                  TextStyle(color: Colors.white, fontSize: 20),
                            ),
                          ),
                          SizedBox(width: 15),
                          Expanded(
                            child: Text(
                              logMessages[index],
                              style: TextStyle(
                                fontSize: 20,
                                color: Colors.black,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
