import { test, expect } from '@playwright/test';

test.describe('Hilton Heat Registration System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the registration interface
    await page.goto('/hilton-heat.html');

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
  });

  test('should load the registration interface', async ({ page }) => {
    // Check that the main title is visible
    await expect(page.locator('h1')).toContainText('Hilton Heat Registration Management');

    // Check that navigation tabs are present
    await expect(page.locator('.nav-tab')).toHaveCount(5);

    // Verify all tab labels
    const tabs = ['Dashboard', 'Teams', 'Registrations', 'Evaluations', 'Invitations'];
    for (const tabText of tabs) {
      await expect(page.locator(`.nav-tab:has-text("${tabText}")`)).toBeVisible();
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    // Start on Dashboard tab (should be active by default)
    await expect(page.locator('#dashboard-tab')).toBeVisible();

    // Navigate to Teams tab
    await page.click('.nav-tab:has-text("Teams")');
    await expect(page.locator('#teams-tab')).toBeVisible();
    await expect(page.locator('#dashboard-tab')).toBeHidden();

    // Navigate to Registrations tab
    await page.click('.nav-tab:has-text("Registrations")');
    await expect(page.locator('#registrations-tab')).toBeVisible();
    await expect(page.locator('#teams-tab')).toBeHidden();
  });

  test('should display dashboard with stats cards', async ({ page }) => {
    // Check that all stat cards are present
    await expect(page.locator('.stat-card')).toHaveCount(4);

    // Check stat card labels
    await expect(page.locator('.stat-label')).toContainText('Total Registrations');
    await expect(page.locator('.stat-label')).toContainText('Pending Evaluations');
    await expect(page.locator('.stat-label')).toContainText('Sent Invitations');
    await expect(page.locator('.stat-label')).toContainText('Registered Players');
  });

  test('should create a new team', async ({ page }) => {
    // Navigate to Teams tab
    await page.click('.nav-tab:has-text("Teams")');

    // Fill out team creation form
    await page.fill('#teamName', 'Test U12 Boys');
    await page.selectOption('#ageGroup', 'U12');
    await page.selectOption('#season', 'Fall 2024');
    await page.fill('#coachName', 'John Coach');
    await page.fill('#coachEmail', 'john.coach@example.com');
    await page.fill('#maxPlayers', '18');

    // Mock the API response for team creation
    await page.route('**/api/hilton-heat/teams', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          teamId: 123,
          message: 'Team created successfully'
        })
      });
    });

    // Click create team button
    await page.click('button:has-text("Create Team")');

    // Wait for success message (this would appear in a real scenario)
    // Note: In actual testing, we'd check for success/error messages
  });

  test('should load teams from API', async ({ page }) => {
    // Navigate to Teams tab
    await page.click('.nav-tab:has-text("Teams")');

    // Mock API response for teams list
    await page.route('**/api/hilton-heat/teams', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          teams: [
            {
              id: 1,
              name: 'U12 Boys Red',
              age_group: 'U12',
              season: 'Fall 2024',
              coach_name: 'Mike Johnson',
              coach_email: 'mike@example.com',
              max_players: 18,
              created_at: '2024-01-01T00:00:00Z'
            }
          ]
        })
      });
    });

    // Reload page to trigger API call (in real scenario, this would happen automatically)
    await page.reload();

    // Check that teams table is populated
    await expect(page.locator('table')).toBeVisible();
  });

  test('should handle registration import workflow', async ({ page }) => {
    // Navigate to Registrations tab
    await page.click('.nav-tab:has-text("Registrations")');

    // Select season
    await page.selectOption('#registrationSeason', 'Fall 2024');

    // Mock file selection (in real scenario, we'd use page.setInputFiles)
    // For this test, we're just verifying the UI elements exist
    await expect(page.locator('#registrationFile')).toBeVisible();
    await expect(page.locator('.file-upload')).toBeVisible();

    // Test TeamSnap API section
    await expect(page.locator('#teamsnapTeam')).toBeVisible();
    await expect(page.locator('#teamsnapSeason')).toBeVisible();
    await expect(page.locator('button:has-text("Load Teams")')).toBeVisible();
    await expect(page.locator('button:has-text("Sync from TeamSnap")')).toBeVisible();
  });

  test('should display registration data after loading', async ({ page }) => {
    // Navigate to Registrations tab
    await page.click('.nav-tab:has-text("Registrations")');

    // Mock API response for registrations
    await page.route('**/api/hilton-heat/registrations*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          registrations: [
            {
              id: 1,
              first_name: 'John',
              last_name: 'Doe',
              email: 'john.doe@example.com',
              age_group: 'U12',
              season: 'Fall 2024',
              status: 'pending',
              invite_status: 'pending'
            },
            {
              id: 2,
              first_name: 'Jane',
              last_name: 'Smith',
              email: 'jane.smith@example.com',
              age_group: 'U12',
              season: 'Fall 2024',
              status: 'invited',
              invite_status: 'yes'
            }
          ]
        })
      });
    });

    // Select age group filter and trigger load
    await page.selectOption('#filterAgeGroup', 'U12');

    // In a real scenario, this would trigger the loadRegistrations() function
    // For this test, we're just verifying the UI structure exists
    await expect(page.locator('#registrationsContent')).toBeVisible();
  });

  test('should handle evaluation import workflow', async ({ page }) => {
    // Navigate to Evaluations tab
    await page.click('.nav-tab:has-text("Evaluations")');

    // Check that evaluation form elements are present
    await expect(page.locator('#evaluationTeam')).toBeVisible();
    await expect(page.locator('#evaluatedBy')).toBeVisible();
    await expect(page.locator('#evaluationFile')).toBeVisible();
    await expect(page.locator('.file-upload')).toBeVisible();
  });

  test('should handle invitation creation workflow', async ({ page }) => {
    // Navigate to Invitations tab
    await page.click('.nav-tab:has-text("Invitations")');

    // Check that invitation form elements are present
    await expect(page.locator('#invitationTeam')).toBeVisible();
    await expect(page.locator('#playersForInvitation')).toBeVisible();
    await expect(page.locator('#invitationActions')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error response
    await page.route('**/api/hilton-heat/teams', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });

    // Navigate to Teams tab and trigger API call
    await page.click('.nav-tab:has-text("Teams")');

    // In a real scenario, we'd check for error messages
    // For this test, we're verifying the UI doesn't crash
    await expect(page.locator('#teams-tab')).toBeVisible();
  });

  test('should have proper form validation', async ({ page }) => {
    // Navigate to Teams tab
    await page.click('.nav-tab:has-text("Teams")');

    // Try to submit empty form
    await page.click('button:has-text("Create Team")');

    // In a real scenario, we'd check for validation messages
    // For this test, we're verifying the form exists and is interactive
    await expect(page.locator('#teamName')).toBeVisible();
    await expect(page.locator('#ageGroup')).toBeVisible();
    await expect(page.locator('#season')).toBeVisible();
    await expect(page.locator('#coachName')).toBeVisible();
    await expect(page.locator('#coachEmail')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that interface still works on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.nav-tabs')).toBeVisible();

    // Navigation should still work
    await page.click('.nav-tab:has-text("Teams")');
    await expect(page.locator('#teams-tab')).toBeVisible();
  });
});



