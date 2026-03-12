const { test, expect } = require('@playwright/test');

test.describe('핵심 기능 검증: 신문고 및 커뮤니티 전송 (Tactical HUD v1.1)', () => {
    test.beforeEach(async ({ page }) => {
        // 로컬 서버 주소
        await page.goto('http://127.0.0.1:3000');
    });

    test('TC-01: 신문고 모달 폼 전송 기능 검증', async ({ page }) => {
        // 신문고 모달 오픈
        await page.click('#shinmungoBtn');

        // 모달이 노출되는지 확인
        const shinmungoModal = page.locator('#shinmungoModal');
        await expect(shinmungoModal).not.toHaveClass(/inactive/);

        // 기타 사유 라디오 버튼 클릭
        await page.click('input[name="reportReason"][value="other"]');

        // 상세 내용 입력
        await page.fill('#reportDetails', '가격이 맞지 않습니다. 신속한 확인 요망.');

        // 폼 제출 완료 버튼 클릭
        await page.click('#shinmungoForm button[type="submit"]');

        // 토스트 노출 확인
        const toast = page.locator('.toast');
        await expect(toast).toContainText('DATA_SENT // 신문고 접수 완료');

        // 폼 제출 후 모달이 닫혀야 함
        await expect(shinmungoModal).toHaveClass(/inactive/);
    });

    test('TC-02: 커뮤니티 모달 폼 전송 기능 검증', async ({ page }) => {
        // 커뮤니티 모달 오픈
        await page.click('#shareCommunityBtn');

        // 모달이 노출되는지 확인
        const communityModal = page.locator('#communityModal');
        await expect(communityModal).not.toHaveClass(/inactive/);

        // 추가 코멘트 입력
        const testComment = '현재 지역 최저가, 이동 요망!';
        await page.fill('#shareComment', testComment);

        // 공유 제출 완료 버튼 클릭
        await page.click('#communityForm button[type="submit"]');

        // 토스트 노출 확인
        const toast = page.locator('.toast');
        await expect(toast).toContainText('SYNC_COMPLETE // 커뮤니티 전송 완료');

        // 폼 닫힘 확인
        await expect(communityModal).toHaveClass(/inactive/);

        // 우측 인텔 피드 리스트에 등록한 내용이 포함된 항목이 추가되었는지 확인
        const feedItemLabel = page.locator('#forumList .forum-item').first();
        await expect(feedItemLabel).toContainText(testComment);
        await expect(feedItemLabel).toContainText('COMMANDER_X');
    });
});
