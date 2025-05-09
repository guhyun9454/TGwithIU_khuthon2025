import 'package:flutter/material.dart';

class LoadingPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white, // 전체 배경을 흰색으로 설정
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min, // 이미지를 가운데 정렬
          children: [
            Image.asset(
              'assets/loading.png', // loading.png 파일 경로
              width: 250, // 크기는 필요에 따라 조정
              height: 250,
              fit: BoxFit.contain,
            ),
            SizedBox(height: 0), // 이미지와 로딩 아이콘 간 여백
            CircularProgressIndicator(
              color: Colors.green, // 로딩 아이콘 색상
            ),
            SizedBox(height: 40), // 하단 여백 추가
          ],
        ),
      ),
    );
  }
}
