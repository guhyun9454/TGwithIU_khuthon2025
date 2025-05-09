import 'package:flutter/material.dart';
import 'main_screen.dart';

class UserIdScreen extends StatefulWidget {
  @override
  _UserIdScreenState createState() => _UserIdScreenState();
}

class _UserIdScreenState extends State<UserIdScreen> {
  final TextEditingController _userIdController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool isAutoLogin = false;
  String? errorMessage;

  void _login() {
    final userId = _userIdController.text.trim();
    final password = _passwordController.text.trim();

    if (userId.isNotEmpty && password == '1234') {
      if (isAutoLogin) {
        // 자동 로그인 저장 로직 (SharedPreferences 등으로 구현 가능)
        print("자동 로그인 활성화");
      }

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => MainScreen()),
      );
    } else {
      setState(() {
        errorMessage = '유효한 아이디 또는 비밀번호를 입력해주세요.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 로고 이미지 (중앙)
            Center(
              child: Image.asset(
                'assets/logo.png', // 로고 이미지 경로 (프로젝트 assets 폴더에 logo.png 추가 필요)
                width: 150,
                height: 150,
                fit: BoxFit.contain,
              ),
            ),
            SizedBox(height: 0), // 로고와 로그인 글자 간격 줄임
            // 로그인 텍스트 왼쪽 정렬, 크기 15
            Text(
              '로그인',
              style: TextStyle(
                color: Colors.black,
                fontSize: 25, // 폰트 크기 줄임
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.left,
            ),
            SizedBox(height: 10),
            // USER ID 입력 (흰색 배경)
            Container(
              width: double.infinity,
              height: 55,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Color(0xFFC6C6C6), width: 1.5),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: TextField(
                  controller: _userIdController,
                  decoration: InputDecoration(
                    labelText: 'USER ID',
                    labelStyle: TextStyle(color: Colors.black, fontSize: 15),
                    border: InputBorder.none,
                  ),
                ),
              ),
            ),
            SizedBox(height: 15),
            // 비밀번호 입력 (흰색 배경)
            Container(
              width: double.infinity,
              height: 55,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Color(0xFFC6C6C6), width: 1.5),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: TextField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'PASSWORD',
                    labelStyle: TextStyle(color: Colors.black, fontSize: 15),
                    border: InputBorder.none,
                  ),
                  obscureText: true,
                ),
              ),
            ),
            SizedBox(height: 0),
            // 자동 로그인 체크박스 (초록색)
            Row(
              children: [
                Checkbox(
                  activeColor: Color(0xFF27B155), // 진한 초록색
                  value: isAutoLogin,
                  onChanged: (value) {
                    setState(() {
                      isAutoLogin = value ?? false;
                    });
                  },
                ),
                Text(
                  '자동 로그인',
                  style: TextStyle(color: Colors.black, fontSize: 15),
                ),
              ],
            ),
            if (errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  errorMessage!,
                  style: TextStyle(color: Colors.red, fontSize: 14),
                ),
              ),
            SizedBox(height: 0),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _login,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF27B155), // 녹색 버튼
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  '로그인',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15, // 폰트 크기 줄임
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            // 하단 여백 추가
            SizedBox(height: 300),
          ],
        ),
      ),
    );
  }
}
