# 구글 시트 연동 시스템 설정 가이드

지분나무의 오버라이드(데이터 수정) 및 오류 신고 기능을 활성화하기 위해 아래 단계를 진행해 주세요.

## 1. 구글 시트 준비
사용자님의 구글 시트에 아래 3개의 탭(Sheet)을 만들어 주세요. (이름이 정확해야 합니다.)
1.  **`Reports`**: 사용자 신고가 쌓이는 곳
2.  **`Overrides`**: 어드민이 수정한 데이터 규칙이 쌓이는 곳
3.  **`Settings`**: 비밀번호 등 설정을 저장하는 곳

### `Settings` 탭 설정
- A1 셀에 `AdminPassword` 라고 적고, B1 셀에 `5` (원하시는 비밀번호)를 적어주세요.

---

## 2. Google Apps Script 코드 복사
구글 시트 메뉴에서 **[확장 프로그램] -> [Apps Script]**를 클릭하고 아래 코드를 기존 내용 삭제 후 붙여넣으세요.

```javascript
/**
 * 지분나무 서버리스 백엔드 브릿지
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const password = data.password;
  
  // 1. 패스워드 체크 (Reports 등록 제외하고는 모두 체크)
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
  const actualPassword = settingsSheet.getRange("B1").getValue().toString();
  
  if (action !== "report" && password !== actualPassword) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid password" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "report") {
    // 오류 신고 등록
    const sheet = ss.getSheetByName("Reports");
    sheet.appendRow([new Date(), data.nodeName, data.nodeId, data.message, "Pending"]);
    return response({ success: true });
  } 
  else if (action === "add_override" || action === "fix_report") {
    // 데이터 교정(오버라이드) 추가
    const sheet = ss.getSheetByName("Overrides");
    sheet.appendRow([new Date(), data.type, data.source, data.target, data.reason]);
    
    // 만약 신고 처리(fix_report)라면 신고 상태 업데이트
    if (action === "fix_report") {
      const reportSheet = ss.getSheetByName("Reports");
      const reportRows = reportSheet.getDataRange().getValues();
      for (let i = 1; i < reportRows.length; i++) {
        if (reportRows[i][2] == data.reportId) { // nodeId 등으로 매칭
          reportSheet.getRange(i + 1, 5).setValue("Resolved");
          break;
        }
      }
    }
    return response({ success: true });
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  
  if (action === "get_data") {
    const reportSheet = ss.getSheetByName("Reports");
    const overrideSheet = ss.getSheetByName("Overrides");
    
    return response({
      reports: reportSheet.getDataRange().getValues().slice(1),
      overrides: overrideSheet.getDataRange().getValues().slice(1)
    });
  }
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

---

## 3. 배포 (가장 중요)
1.  오른쪽 상단 **[배포] -> [새 배포]**를 누릅니다.
2.  유형 선택(톱니바퀴)에서 **[웹 앱]**을 선택합니다.
3.  설정:
    - **다음 사용자 권한으로 실행**: `나 (사용자님의 이메일)`
    - **액세스 가능한 사용자**: **`모든 사람 (Anyone)`** (중요!)
4.  **[배포]** 버튼을 누르고, 뜨는 창에서 **[액세스 승인]**을 완료합니다.
5.  최종적으로 나오는 **`웹 앱 URL`**을 복사해서 저에게 알려주세요!
