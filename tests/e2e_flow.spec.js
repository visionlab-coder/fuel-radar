const { test, expect } = require('@playwright/test');

test.describe('핵심 기능 검증: 신문고 및 커뮤니티 전송', () => {
    test.beforeEach(async ({ page }) => {
        // 로컬 서버나 배포된 서버 주소 (로컬에서 테스트 진행)
        await page.goto('http://127.0.0.1:3000');
    });

    test('TC-01: 신문고 모달 폼 전송 기능 검증', async ({ page }) => {
        // 신문고 모달 오픈
        await page.click('#shinmungoBtn');

        // 모달이 노출되는지 확인
        const shinmungoModal = page.locator('#shinmungoModal');
        await expect(shinmungoModal).not.toHaveClass(/hidden/);

        // 기타 사유 라디오 버튼 클릭
        await page.click('input[name="reportReason"][value="other"]');

        // 상세 내용 입력
        await page.fill('#reportDetails', '동네 주민인데 여기 표시된 가격과 달라요 확인 부탁드려요.');

        // 폼 제출 완료 버튼 클릭
        await page.click('#shinmungoForm button[type="submit"]');

        // 토스트 노출 확인
        const toast = page.locator('.toast');
        await expect(toast).toContainText('✅ 신문고 접수가 완료되었습니다');

        // 폼 제출 후 모달이 닫혀야 함
        await expect(shinmungoModal).toHaveClass(/hidden/);
    });

    test('TC-02: 커뮤니티 모달 폼 전송 기능 검증', async ({ page }) => {
        // 커뮤니티 모달 오픈
        await page.click('#shareCommunityBtn');

        // 모달이 노출되는지 확인
        const communityModal = page.locator('#communityModal');
        await expect(communityModal).not.toHaveClass(/hidden/);

        // 추가 코멘트 입력
        const testComment = '오늘 정말 저렴하네요 강추!';
        await page.fill('#shareComment', testComment);

        // 공유 제출 완료 버튼 클릭
        await page.click('#communityForm button[type="submit"]');

        // 토스트 노출 확인
        const toast = page.locator('.toast');
        await expect(toast).toContainText('📢 커뮤니티에 성공적으로 공유되었습니다!');

        // 폼 닫힘 확인
        await expect(communityModal).toHaveClass(/hidden/);

        // 하단 피드 리스트에 등록한 내용이 포함된 항목이 추가되었는지 확인
        const feedItemLabel = page.locator('.list-item h3.station-name').first();
        await expect(feedItemLabel).toContainText(`" ${testComment} "`);
    });
});
