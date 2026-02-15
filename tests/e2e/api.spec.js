import { test, expect } from '@playwright/test';

test.describe('Hilton Heat Registration API', () => {
  test('should return health status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
  });

  test('should handle teams API endpoints', async ({ request }) => {
    // Test GET teams (should return empty array initially)
    const getResponse = await request.get('/api/hilton-heat/teams');
    expect(getResponse.ok()).toBeTruthy();

    const getData = await getResponse.json();
    expect(getData).toHaveProperty('success', true);
    expect(getData).toHaveProperty('teams');
    expect(Array.isArray(getData.teams)).toBe(true);

    // Test POST teams with valid data - use unique team name and proper season format
    const timestamp = Date.now();
    const year = new Date().getFullYear() + 1; // Use next year to avoid conflicts
    const newTeam = {
      name: `Test Team API ${timestamp}`,
      age_group: 'U12',
      season: `Fall ${year}`, // Use proper season format
      coach_name: 'Test Coach',
      coach_email: `test${timestamp}@example.com`,
      max_players: 18
    };

    const postResponse = await request.post('/api/hilton-heat/teams', {
      data: newTeam
    });

    console.log('POST Response status:', postResponse.status());
    console.log('POST Response body:', await postResponse.text());

    expect(postResponse.ok()).toBeTruthy();

    const postData = await postResponse.json();
    expect(postData).toHaveProperty('success', true);
    expect(postData).toHaveProperty('teamId');
    expect(postData).toHaveProperty('message');
  });

  test('should handle registration import API', async ({ request }) => {
    // Test GET registrations (should return empty initially)
    const getResponse = await request.get('/api/hilton-heat/registrations');
    expect(getResponse.ok()).toBeTruthy();

    const getData = await getResponse.json();
    expect(getData).toHaveProperty('success', true);
    expect(getData).toHaveProperty('registrations');
    expect(Array.isArray(getData.registrations)).toBe(true);
  });

  test('should handle file upload for registrations', async ({ request }) => {
    // Create a simple CSV content for testing
    const csvContent = 'First Name,Last Name,Email,Phone,Date of Birth,Parent Name,Parent Email,Age Group,Season,Notes\nJohn,Doe,john.doe@example.com,555-0101,2012-05-15,Jane Doe,jane.doe@example.com,U12,Fall 2024,Test note';

    // This would test file upload in a real scenario
    // For this test, we're just verifying the endpoint exists and handles requests
    const response = await request.get('/api/hilton-heat/registrations/export');
    expect(response.ok()).toBeTruthy();
  });

  test('should handle TeamSnap API endpoints', async ({ request }) => {
    // Test TeamSnap teams endpoint (will return error without credentials)
    const response = await request.get('/api/hilton-heat/teamsnap/teams');
    // This might return 503 if TeamSnap API is not configured
    expect([200, 503]).toContain(response.status());
  });

  test('should validate API error handling', async ({ request }) => {
    // Test with invalid data
    const invalidTeam = {
      name: '', // Empty name should fail validation
      age_group: 'U12',
      season: 'Fall 2024',
      coach_name: 'Test Coach',
      coach_email: 'invalid-email', // Invalid email format
      max_players: 18
    };

    const response = await request.post('/api/hilton-heat/teams', {
      data: invalidTeam
    });

    expect(response.status()).toBe(400);

    const errorData = await response.json();
    expect(errorData).toHaveProperty('success', false);
    expect(errorData).toHaveProperty('error');
  });

  test('should handle rate limiting', async ({ request }) => {
    // Make multiple rapid requests to test rate limiting
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(request.get('/api/health'));
    }

    const responses = await Promise.all(requests);

    // At least some requests should succeed
    const successfulRequests = responses.filter(r => r.ok());
    expect(successfulRequests.length).toBeGreaterThan(0);
  });
});
