import 'package:flutter/material.dart';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'dart:convert';

class MainScreen extends StatefulWidget {
  @override
  _MainScreenState createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  String statusMessage = "이상이 없습니다.";
  List<String> logMessages = ["이상이 없습니다."];
  String currentTime = "";
  String currentImageUrl = "";
  bool isPaused = false;
  Timer? statusTimer;
  final ScrollController _logScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _updateTime();
    _fetchStatus();
  }

  void _updateTime() {
    Timer.periodic(Duration(seconds: 1), (timer) {
      setState(() {
        currentTime = _formattedCurrentTime();
      });
    });
  }

  void _fetchStatus() {
    statusTimer = Timer.periodic(Duration(seconds: 1), (timer) async {
      if (isPaused) return;
      try {
        final response =
            await http.get(Uri.parse('http://localhost:8081/api/status'));
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          String newStatus = "";
          String jobId = data["jobId"] ?? "";

          switch (data["status"]) {
            case "normal":
              newStatus = "이상이 없습니다.";
              break;
            case "animal_alert":
              newStatus = data["animalInfo"]
                  .map((a) => "야생동물 (" + a["name"] + ")이 나타났습니다.")
                  .join(", ");
              break;
            case "human_alert":
              newStatus = "외부인이 나타났습니다.";
              break;
            case "weather_alert":
              newStatus = "악천후입니다. 작물 상태를 확인하세요.";
              break;
            default:
              newStatus = "이상이 없습니다.";
          }

          if (newStatus != statusMessage) {
            setState(() {
              statusMessage = newStatus;
              logMessages.insert(0, statusMessage);
              if (logMessages.length > 50) logMessages.removeAt(0);
            });
          }

          if (jobId.isNotEmpty) _fetchImage(jobId);
        }
      } catch (e) {
        print("Error fetching status: $e");
      }
    });
  }

  void _fetchImage(String jobId) async {
    try {
      final response = await http
          .get(Uri.parse('http://localhost:9454/api/image-result/$jobId'));
      if (response.statusCode == 200) {
        setState(() {
          currentImageUrl = 'http://localhost:9454/api/image-result/$jobId';
        });
      }
    } catch (e) {
      print("Error fetching image: $e");
    }
  }

  String _formattedCurrentTime() {
    final now = DateTime.now();
    return "${now.year}/${_twoDigits(now.month)}/${_twoDigits(now.day)} ${_twoDigits(now.hour)}:${_twoDigits(now.minute)}:${_twoDigits(now.second)}";
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');

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
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Column(
          children: [
            SizedBox(height: 10),
            currentImageUrl.isNotEmpty
                ? Image.network(currentImageUrl)
                : CircularProgressIndicator(),
            SizedBox(height: 10),
            Text(currentTime,
                style: TextStyle(fontSize: 15, color: Colors.black54)),
            SizedBox(height: 15),
            Text('상태',
                style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold)),
            Expanded(
              child: ListView.builder(
                controller: _logScrollController,
                itemCount: logMessages.length,
                itemBuilder: (context, index) => Container(
                  padding: EdgeInsets.all(12),
                  margin: EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    border: Border.all(color: Color(0xFFDFDFDF)),
                    borderRadius: BorderRadius.circular(22),
                    color: logMessages[index].contains("이상이 없습니다.")
                        ? Color(0xFF27B155).withOpacity(0.1)
                        : Color(0xFFD50000).withOpacity(0.1),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 60,
                        height: 35,
                        decoration: BoxDecoration(
                          color: logMessages[index].contains("이상이 없습니다.")
                              ? Color(0xFF27B155)
                              : Color(0xFFD50000),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          logMessages[index].contains("이상이 없습니다.")
                              ? "안전"
                              : "경고",
                          style: TextStyle(color: Colors.white, fontSize: 20),
                        ),
                      ),
                      SizedBox(width: 15),
                      Expanded(
                        child: Text(
                          logMessages[index],
                          style: TextStyle(
                              fontSize: 20,
                              color: Colors.black,
                              fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
