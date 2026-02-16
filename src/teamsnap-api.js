const axios = require('axios');

class TeamSnapAPI {
  constructor() {
    // Use the official TeamSnap v3 API
    this.baseURL = 'https://api.teamsnap.com/v3';
    this.orgAPIBaseURL = 'https://organization-api.teamsnap.com';
    this.clientId = process.env.TEAMSNAP_CLIENT_ID;
    this.clientSecret = process.env.TEAMSNAP_CLIENT_SECRET;
    this.username = process.env.TEAMSNAP_USERNAME;
    this.password = process.env.TEAMSNAP_PASSWORD;
    this.accessToken = null; // Will be obtained via OAuth
  }

  /**
   * Get an OAuth access token using Resource Owner Password Credentials grant
   * This requires a TeamSnap username and password
   */
  async getAccessToken() {
    try {
      if (this.accessToken) {
        return this.accessToken; // Reuse existing token
      }

      console.log('Obtaining OAuth access token from TeamSnap...');
      
      // Determine which OAuth grant type to use
      let grantData;
      
      if (this.username && this.password) {
        // Use Resource Owner Password Credentials grant for user-level access
        console.log('Using username/password authentication (Resource Owner Password Credentials)');
        grantData = {
          grant_type: 'password',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username: this.username,
          password: this.password,
          scope: 'read write'
        };
      } else {
        // Fall back to client credentials (limited access)
        console.log('Using client credentials authentication (limited access)');
        grantData = {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        };
      }
      
      const response = await axios.post('https://auth.teamsnap.com/oauth/token', grantData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      console.log(`✅ OAuth access token obtained (scope: ${response.data.scope})`);
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to obtain OAuth access token:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        throw new Error('OAuth authentication failed: Invalid username or password');
      }
      throw new Error('OAuth authentication failed');
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TeamSnap OAuth credentials not configured');
      }

      // Get OAuth access token
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.baseURL}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.collection+json'
        }
      });

      console.log('Successfully connected to TeamSnap API');
      return {
        success: true,
        message: 'TeamSnap API connection successful'
      };

    } catch (error) {
      console.error('TeamSnap API connection failed:', error.response?.data || error.message);
      return {
        success: false,
        error: 'Failed to connect to TeamSnap API'
      };
    }
  }

  /**
   * Get registration data from TeamSnap
   */
  async getRegistrations(teamId, season = null) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TeamSnap OAuth credentials not configured');
      }

      // Get OAuth access token
      const token = await this.getAccessToken();

      // Parse teamId to extract organization and form IDs
      let organizationId, formId;

      if (teamId && teamId.includes('/')) {
        // If teamId looks like "organizationId/registrationId" or "organizationId/formId"
        const parts = teamId.split('/');
        if (parts.length === 3) {
          // Format: "organizationId/registration/formId"
          organizationId = parts[0];
          formId = parts[2];
        } else if (parts.length === 2) {
          // Format: "organizationId/formId"
          organizationId = parts[0];
          formId = parts[1];
        } else {
          throw new Error('Invalid team ID format. Expected: organizationId/formId or organizationId/registration/formId');
        }
      } else {
        // For backward compatibility, assume teamId is organizationId
        organizationId = teamId;
        formId = 'registrations'; // Default form ID
      }

      if (!organizationId || !formId) {
        throw new Error('Invalid team ID format. Expected: organizationId/formId');
      }

      // Use the TeamSnap v3 API endpoint for registration signups
      // The formId is actually the registration_form_id
      // Try multiple endpoint variations to find registrations
      const endpoints = [
        `${this.orgAPIBaseURL}/organizations/${organizationId}/export/form_result_reports/${formId}`,
        `${this.baseURL}/registration_signups/search?registration_form_id=${formId}`,
        `${this.baseURL}/registration_signups?registration_form_id=${formId}`,
        `${this.baseURL}/member_registration_signups/search?registration_form_id=${formId}`
      ];

      console.log('======================================');
      console.log('TeamSnap API Request Details:');
      console.log(`  Organization ID: ${organizationId}`);
      console.log(`  Registration Form ID: ${formId}`);
      console.log(`  OAuth Access Token: ${token ? token.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`  Season: ${season || 'Not specified'}`);
      console.log(`  Trying ${endpoints.length} different endpoints...`);
      console.log('======================================');

      let response = null;
      let successfulEndpoint = null;

      // Try each endpoint until we find one that returns data
      for (let i = 0; i < endpoints.length; i++) {
        const signupsEndpoint = endpoints[i];
        const isOrgAPI = signupsEndpoint.includes('organization-api.teamsnap.com');
        const method = isOrgAPI ? 'POST' : 'GET';
        
        console.log(`\n[${i + 1}/${endpoints.length}] Trying ${method} ${signupsEndpoint}`);
        console.log('Authorization header:', `Bearer ${token.substring(0, 20)}...`);
        
        try {
          const config = {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': isOrgAPI ? 'application/json' : 'application/vnd.collection+json',
              'Content-Type': 'application/json'
            },
            timeout: 30000,
            validateStatus: function (status) {
              return status < 500;
            }
          };

          response = isOrgAPI 
            ? await axios.post(signupsEndpoint, {}, config)
            : await axios.get(signupsEndpoint, config);

          console.log(`  Status: ${response.status} ${response.statusText}`);
          
          // Log response structure for debugging
          if (isOrgAPI) {
            console.log(`  Response keys: ${Object.keys(response.data || {}).join(', ')}`);
            console.log(`  Full response: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...`);
          }
          
          // Check for different response formats
          const itemsCount = response.data?.collection?.items?.length 
            || response.data?.registrations?.length 
            || response.data?.length 
            || 0;
          
          console.log(`  Items found: ${itemsCount}`);
          console.log(`  Response type: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);

          // If we found items, use this endpoint
          if (itemsCount > 0) {
            successfulEndpoint = signupsEndpoint;
            console.log(`✅ Found ${itemsCount} registrations!`);
            break;
          }
        } catch (err) {
          console.log(`  ❌ Error: ${err.response?.status || 'N/A'} - ${err.message}`);
          continue;
        }
      }

      if (!response || response.status >= 400) {
        throw new Error(`HTTP ${response?.status || 'N/A'}: ${response?.statusText || 'No response'}`);
      }

      console.log('======================================');
      console.log('Final Endpoint Used:', successfulEndpoint || endpoints[0]);
      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log(`  Content-Type: ${response.headers['content-type']}`);
      console.log(`  Items: ${response.data?.collection?.items?.length || 0}`);
      console.log('======================================');

      // Parse the collection+json response
      if (response.data && response.data.collection && response.data.collection.items) {
        console.log('Processing collection+json response...');
        const items = response.data.collection.items;
        const registrations = items.map(item => {
          const data = {};
          
          // Extract data from the collection+json format
          item.data.forEach(field => {
            data[field.name] = field.value;
          });

          return {
            id: data.id,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || '',
            phone: data.phone_number || '',
            date_of_birth: data.birthday || '',
            parent_name: data.guardian_name || '',
            parent_email: data.guardian_email || '',
            age_group: this.calculateAgeGroup(data.birthday),
            season: season || this.getCurrentSeason(),
            source: 'teamsnap',
            external_id: data.id,
            notes: `Status: ${data.status || 'Unknown'}`
          };
        });

        console.log(`Successfully parsed ${registrations.length} registrations from API`);

        return {
          success: true,
          registrations: registrations,
          teamId: teamId,
          count: registrations.length,
          format: 'json'
        };
      }

      // Fallback for non-standard responses
      console.warn('Response was not in expected format, returning empty registrations');
      return {
        success: true,
        registrations: [],
        teamId: teamId,
        note: 'No registration data found or unsupported format'
      };

    } catch (error) {
      console.error('======================================');
      console.error('TeamSnap API Error Details:');
      console.error(`  Error Type: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      console.error(`  HTTP Status: ${error.response?.status || 'N/A'}`);
      console.error(`  Response Data: ${JSON.stringify(error.response?.data || {}, null, 2)}`);
      console.error('======================================');

      // Handle specific API errors
      if (error.response?.status === 404) {
        return {
          success: true,
          registrations: [],
          teamId: teamId,
          note: 'Team not found or no registrations available for this team'
        };
      } else if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Authentication failed - check TeamSnap API credentials'
        };
      } else {
        return {
          success: false,
          error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
        };
      }
    }
  }

  /**
   * Parse CSV data from TeamSnap export
   */
  parseCSVRegistrations(csvData, season = null) {
    try {
      // Split CSV into lines
      const lines = csvData.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return []; // No data or only header
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const registrations = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length !== headers.length) continue; // Skip malformed lines

        const regData = {};
        headers.forEach((header, index) => {
          regData[header] = values[index];
        });

        // Map CSV fields to our registration format
        const registration = {
          first_name: regData['first name'] || regData['first_name'] || '',
          last_name: regData['last name'] || regData['last_name'] || '',
          email: regData['email'] || '',
          phone: regData['phone'] || '',
          date_of_birth: regData['date of birth'] || regData['birth_date'] || regData['birth date'] || '',
          parent_name: regData['parent name'] || regData['parent'] || regData['guardian'] || '',
          parent_email: regData['parent email'] || regData['parent_email'] || '',
          age_group: this.calculateAgeGroup(regData['date of birth'] || regData['birth_date'] || regData['birth date']),
          season: season || this.getCurrentSeason(),
          source: 'teamsnap',
          external_id: regData['id'] || regData['participant id'] || `csv_${i}`,
          notes: regData['notes'] || regData['additional notes'] || ''
        };

        // Only include registrations with at least a name and email
        if (registration.first_name && registration.last_name && registration.email) {
          registrations.push(registration);
        }
      }

      return registrations;

    } catch (error) {
      console.error('Error parsing CSV data:', error);
      return [];
    }
  }

  /**
   * Calculate age group from date of birth
   */
  calculateAgeGroup(dateOfBirth) {
    if (!dateOfBirth) return 'Unknown';

    const birthDate = new Date(dateOfBirth);
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthDate.getFullYear();

    // TeamSnap uses U8, U9, etc. format
    if (age >= 8 && age <= 19) {
      return `U${age}`;
    }

    return 'Unknown';
  }

  /**
   * Get current season (Fall or Spring of current year)
   */
  getCurrentSeason() {
    const now = new Date();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed
    const year = now.getFullYear();

    if (month >= 8) { // August-December
      return `Fall ${year}`;
    } else { // January-July
      return `Spring ${year}`;
    }
  }

         /**
          * Get information about the authenticated user
          */
         async getMe() {
           try {
             if (!this.clientId || !this.clientSecret) {
               throw new Error('TeamSnap OAuth credentials not configured');
             }

             const token = await this.getAccessToken();

             const endpoint = `${this.baseURL}/me`;

             const response = await axios.get(endpoint, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: function (status) {
                 return status < 500;
               }
             });

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             if (response.data && response.data.collection && response.data.collection.items && response.data.collection.items[0]) {
               const item = response.data.collection.items[0];
               const data = {};
               item.data.forEach(field => {
                 data[field.name] = field.value;
               });

               // Get links from the response
               const links = {};
               if (item.links) {
                 item.links.forEach(link => {
                   links[link.rel] = link.href;
                 });
               }

               return {
                 success: true,
                 user: data,
                 links: links
               };
             }

             return {
               success: false,
               error: 'User info not found'
             };

           } catch (error) {
             console.error('Error fetching user info:', error.response?.data || error.message);
             return {
               success: false,
               error: error.message
             };
           }
         }

         /**
          * Get all divisions the authenticated user has access to
          */
         async getDivisions() {
           try {
             if (!this.clientId || !this.clientSecret) {
               throw new Error('TeamSnap OAuth credentials not configured');
             }

             const token = await this.getAccessToken();

             console.log('Fetching divisions from TeamSnap via /me endpoint...');

             // First, get the /me endpoint to find the divisions link
             const meResponse = await axios.get(`${this.baseURL}/me`, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000
             });

             // Extract the divisions link from /me response
             let divisionsUrl = null;
             if (meResponse.data && meResponse.data.collection && meResponse.data.collection.items && meResponse.data.collection.items[0]) {
               const meItem = meResponse.data.collection.items[0];
               const divisionsLink = meItem.links?.find(link => link.rel === 'divisions');
               divisionsUrl = divisionsLink?.href;
             }

             if (!divisionsUrl) {
               console.log('No divisions link found in /me response');
               return {
                 success: true,
                 divisions: [],
                 count: 0,
                 note: 'No divisions link available from /me endpoint'
               };
             }

             console.log(`Following divisions link: ${divisionsUrl}`);

             const response = await axios.get(divisionsUrl, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: function (status) {
                 return status < 500;
               }
             });

             console.log(`Divisions API Response: ${response.status} ${response.statusText}`);
             console.log(`Divisions count: ${response.data?.collection?.items?.length || 0}`);

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             if (response.data && response.data.collection && response.data.collection.items) {
               const divisions = response.data.collection.items.map(item => {
                 const data = {};
                 item.data.forEach(field => {
                   data[field.name] = field.value;
                 });

                 // Get links from the response
                 const links = {};
                 if (item.links) {
                   item.links.forEach(link => {
                     links[link.rel] = link.href;
                   });
                 }

                 return {
                   id: data.id,
                   name: data.name || 'Unnamed Division',
                   season_name: data.season_name,
                   league_name: data.league_name,
                   organization_id: data.organization_id,
                   links: links,
                   href: item.href
                 };
               });

               console.log(`✅ Found ${divisions.length} division(s)`);

               return {
                 success: true,
                 divisions: divisions,
                 count: divisions.length
               };
             }

             return {
               success: true,
               divisions: [],
               count: 0,
               note: 'No divisions found'
             };

           } catch (error) {
             console.error('Error fetching divisions:', error.response?.data || error.message);
             return {
               success: false,
               error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
             };
           }
         }

         /**
          * Get all teams for a specific division
          */
         async getDivisionTeams(divisionId) {
           try {
             if (!this.clientId || !this.clientSecret) {
               throw new Error('TeamSnap OAuth credentials not configured');
             }

             const token = await this.getAccessToken();

             console.log(`Fetching teams for division ${divisionId}...`);

             const endpoint = `${this.baseURL}/teams/search?division_id=${divisionId}`;

             const response = await axios.get(endpoint, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: function (status) {
                 return status < 500;
               }
             });

             console.log(`Division Teams Response: ${response.status}, Items: ${response.data?.collection?.items?.length || 0}`);

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             if (response.data && response.data.collection && response.data.collection.items) {
               const teams = response.data.collection.items.map(item => {
                 const data = {};
                 item.data.forEach(field => {
                   data[field.name] = field.value;
                 });

                 const links = {};
                 if (item.links) {
                   item.links.forEach(link => {
                     links[link.rel] = link.href;
                   });
                 }

                 return {
                   id: data.id,
                   name: data.name || 'Unnamed Team',
                   division_id: data.division_id,
                   division_name: data.division_name,
                   season_name: data.season_name,
                   league_name: data.league_name,
                   sport_name: data.sport_name,
                   organization_id: data.organization_id,
                   links: links,
                   href: item.href
                 };
               });

               return {
                 success: true,
                 teams: teams,
                 count: teams.length,
                 division_id: divisionId
               };
             }

             return {
               success: true,
               teams: [],
               count: 0,
               division_id: divisionId
             };

           } catch (error) {
             console.error('Error fetching division teams:', error.response?.data || error.message);
             return {
               success: false,
               error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
             };
           }
         }

         /**
          * Get all subdivisionsand teams recursively for a division
          */
         async getDivisionHierarchy(divisionId, token, allTeams = [], allDivisions = []) {
           try {
             // Get teams from active_teams link
             const divResponse = await axios.get(`${this.baseURL}/divisions/${divisionId}`, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000
             });

             if (divResponse.data && divResponse.data.collection && divResponse.data.collection.items && divResponse.data.collection.items[0]) {
               const divItem = divResponse.data.collection.items[0];
               
               // Extract division data
               const divData = {};
               divItem.data.forEach(field => {
                 divData[field.name] = field.value;
               });
               
               allDivisions.push(divData.name || divisionId);
               
               // Get links
               const activeTeamsLink = divItem.links?.find(link => link.rel === 'active_teams');
               const childrenLink = divItem.links?.find(link => link.rel === 'children');
               
               // Fetch active teams if link exists
               if (activeTeamsLink) {
                 console.log(`    Fetching teams from: ${divData.name || divisionId}`);
                 const teamsResponse = await axios.get(activeTeamsLink.href, {
                   headers: {
                     'Authorization': `Bearer ${token}`,
                     'Accept': 'application/vnd.collection+json'
                   },
                   timeout: 30000
                 });
                 
                 if (teamsResponse.data && teamsResponse.data.collection && teamsResponse.data.collection.items) {
                   const teams = teamsResponse.data.collection.items.map(item => {
                     const data = {};
                     item.data.forEach(field => {
                       data[field.name] = field.value;
                     });
                     
                     const links = {};
                     if (item.links) {
                       item.links.forEach(link => {
                         links[link.rel] = link.href;
                       });
                     }
                     
                     return {
                       id: data.id,
                       name: data.name || 'Unnamed Team',
                       division_id: data.division_id,
                       division_name: data.division_name,
                       season_name: data.season_name,
                       league_name: data.league_name,
                       sport_name: data.sport_name,
                       organization_id: data.organization_id,
                       links: links,
                       href: item.href
                     };
                   });
                   
                   if (teams.length > 0) {
                     console.log(`      Found ${teams.length} active teams`);
                     allTeams.push(...teams);
                   }
                 }
               }
               
               // Recursively fetch children divisions
               if (childrenLink) {
                 const childrenResponse = await axios.get(childrenLink.href, {
                   headers: {
                     'Authorization': `Bearer ${token}`,
                     'Accept': 'application/vnd.collection+json'
                   },
                   timeout: 30000
                 });
                 
                 if (childrenResponse.data && childrenResponse.data.collection && childrenResponse.data.collection.items) {
                   for (const childItem of childrenResponse.data.collection.items) {
                     const childData = {};
                     childItem.data.forEach(field => {
                       childData[field.name] = field.value;
                     });
                     
                     if (childData.id) {
                       await this.getDivisionHierarchy(childData.id, token, allTeams, allDivisions);
                     }
                   }
                 }
               }
             }

           } catch (error) {
             console.error(`Error fetching division hierarchy for ${divisionId}:`, error.message);
           }
         }

         /**
          * Get all teams across all divisions (organization-wide)
          */
         async getAllOrganizationTeams() {
           try {
             console.log('Fetching all organization teams via division hierarchy...');

             const token = await this.getAccessToken();

             // First get all divisions
             const divisionsResult = await this.getDivisions();
             
             if (!divisionsResult.success || divisionsResult.count === 0) {
               console.log('No divisions found, falling back to user teams');
               return await this.getTeams();
             }

             console.log(`Found ${divisionsResult.count} top-level divisions`);
             console.log(`Recursively fetching teams from division hierarchy...`);

             const allTeams = [];
             const allDivisions = [];
             
             // Recursively fetch teams from each division and subdivisions
             for (const division of divisionsResult.divisions) {
               console.log(`  Processing division: ${division.name}...`);
               await this.getDivisionHierarchy(division.id, token, allTeams, allDivisions);
             }

             // Remove duplicates (same team might appear in multiple queries)
             const uniqueTeams = Array.from(new Map(allTeams.map(team => [team.id, team])).values());

             console.log(`✅ Total unique teams found: ${uniqueTeams.length}`);
             console.log(`✅ Total divisions checked: ${allDivisions.length}`);

             return {
               success: true,
               teams: uniqueTeams,
               count: uniqueTeams.length,
               divisions_checked: allDivisions.length
             };

           } catch (error) {
             console.error('Error fetching organization teams:', error);
             return {
               success: false,
               error: error.message
             };
           }
         }

         /**
          * Get all teams the authenticated user has access to
          */
         async getTeams() {
           try {
             if (!this.clientId || !this.clientSecret) {
               throw new Error('TeamSnap OAuth credentials not configured');
             }

             const token = await this.getAccessToken();

             console.log('Fetching teams from TeamSnap via /me endpoint...');

             // First, get the /me endpoint to find the teams link
             const meResponse = await axios.get(`${this.baseURL}/me`, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000
             });

             // Extract the teams link from /me response
             let teamsUrl = null;
             if (meResponse.data && meResponse.data.collection && meResponse.data.collection.items && meResponse.data.collection.items[0]) {
               const meItem = meResponse.data.collection.items[0];
               const teamsLink = meItem.links?.find(link => link.rel === 'teams');
               teamsUrl = teamsLink?.href;
             }

             if (!teamsUrl) {
               console.log('No teams link found in /me response');
               return {
                 success: true,
                 teams: [],
                 count: 0,
                 note: 'No teams link available from /me endpoint'
               };
             }

             console.log(`Following teams link: ${teamsUrl}`);

             const response = await axios.get(teamsUrl, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: function (status) {
                 return status < 500;
               }
             });

             console.log(`Teams API Response: ${response.status} ${response.statusText}`);
             console.log(`Response has collection: ${!!response.data?.collection}`);
             console.log(`Response has items: ${!!response.data?.collection?.items}`);
             console.log(`Items count: ${response.data?.collection?.items?.length || 0}`);

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             if (response.data && response.data.collection && response.data.collection.items) {
               const teams = response.data.collection.items.map(item => {
                 const data = {};
                 item.data.forEach(field => {
                   data[field.name] = field.value;
                 });

                 // Get links from the response
                 const links = {};
                 if (item.links) {
                   item.links.forEach(link => {
                     links[link.rel] = link.href;
                   });
                 }

                 return {
                   id: data.id,
                   name: data.name || 'Unnamed Team',
                   division_id: data.division_id,
                   division_name: data.division_name,
                   season_name: data.season_name,
                   league_name: data.league_name,
                   sport_name: data.sport_name,
                   organization_id: data.organization_id,
                   created_at: data.created_at,
                   is_ownership_pending: data.is_ownership_pending,
                   links: links,
                   href: item.href
                 };
               });

               console.log(`✅ Found ${teams.length} team(s)`);

               return {
                 success: true,
                 teams: teams,
                 count: teams.length
               };
             }

             return {
               success: true,
               teams: [],
               count: 0,
               note: 'No teams found'
             };

           } catch (error) {
             console.error('Error fetching teams:', error.response?.data || error.message);
             return {
               success: false,
               error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
             };
           }
         }

         /**
          * Get members for a specific team
          */
         async getTeamMembers(teamId) {
           try {
             if (!this.clientId || !this.clientSecret) {
               throw new Error('TeamSnap OAuth credentials not configured');
             }

             const token = await this.getAccessToken();

             console.log(`Fetching members for team ${teamId}...`);

             const endpoint = `${this.baseURL}/members/search?team_id=${teamId}`;

             const response = await axios.get(endpoint, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: function (status) {
                 return status < 500;
               }
             });

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             if (response.data && response.data.collection && response.data.collection.items) {
               const members = response.data.collection.items.map(item => {
                 const data = {};
                 item.data.forEach(field => {
                   data[field.name] = field.value;
                 });

                 // Get links from the response
                 const links = {};
                 if (item.links) {
                   item.links.forEach(link => {
                     links[link.rel] = link.href;
                   });
                 }

                 return {
                   id: data.id,
                   first_name: data.first_name || '',
                   last_name: data.last_name || '',
                   email: data.email_address || '',
                   phone: data.phone_number || '',
                   birthday: data.birthday || '',
                   gender: data.gender || '',
                   position: data.position || '',
                   jersey_number: data.jersey_number || '',
                   is_non_player: data.is_non_player || false,
                   is_manager: data.is_manager || false,
                   is_owner: data.is_owner || false,
                   team_id: data.team_id,
                   created_at: data.created_at,
                   links: links,
                   href: item.href
                 };
               });

               console.log(`✅ Found ${members.length} member(s)`);

               return {
                 success: true,
                 members: members,
                 count: members.length,
                 team_id: teamId
               };
             }

             return {
               success: true,
               members: [],
               count: 0,
               team_id: teamId,
               note: 'No members found'
             };

           } catch (error) {
             console.error('Error fetching team members:', error.response?.data || error.message);
             return {
               success: false,
               error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
             };
           }
         }

         /**
          * Get all members in a division (single API call)
          */
         async getDivisionMembers(divisionId) {
           try {
             const token = await this.getAccessToken();
             const endpoint =
               `${this.baseURL}/members/search?division_id=${divisionId}`;

             const response = await axios.get(endpoint, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: s => s < 500
             });

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             const members = (response.data?.collection?.items || []).map(item => {
               const data = {};
               item.data.forEach(f => { data[f.name] = f.value; });
               return {
                 id: data.id,
                 first_name: data.first_name || '',
                 last_name: data.last_name || '',
                 email: data.email_address || '',
                 phone: data.phone_number || '',
                 position: data.position || '',
                 is_non_player: data.is_non_player || false,
                 is_manager: data.is_manager || false,
                 is_owner: data.is_owner || false,
                 team_id: data.team_id
               };
             });

             return { success: true, members, count: members.length };
           } catch (error) {
             console.error('Error fetching division members:', error.message);
             return { success: false, members: [], count: 0 };
           }
         }

         /**
          * Get email addresses for one or more teams.
          * Accepts a single team ID or comma-separated IDs.
          */
         async getTeamMemberEmails(teamId) {
           try {
             const token = await this.getAccessToken();
             const endpoint =
               `${this.baseURL}/member_email_addresses/search?team_id=${teamId}`;

             const response = await axios.get(endpoint, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: s => s < 500
             });

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             const emailMap = {}; // member_id -> email
             if (response.data?.collection?.items) {
               for (const item of response.data.collection.items) {
                 const data = {};
                 item.data.forEach(f => { data[f.name] = f.value; });
                 if (data.member_id && data.email) {
                   emailMap[data.member_id] = data.email;
                 }
               }
             }
             return { success: true, emailMap };
           } catch (error) {
             console.error('Error fetching member emails:', error.message);
             return { success: false, emailMap: {} };
           }
         }

         /**
          * Get phone numbers for one or more teams.
          * Accepts a single team ID or comma-separated IDs.
          */
         async getTeamMemberPhones(teamId) {
           try {
             const token = await this.getAccessToken();
             const endpoint =
               `${this.baseURL}/member_phone_numbers/search?team_id=${teamId}`;

             const response = await axios.get(endpoint, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/vnd.collection+json'
               },
               timeout: 30000,
               validateStatus: s => s < 500
             });

             if (response.status >= 400) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             const phoneMap = {}; // member_id -> phone
             if (response.data?.collection?.items) {
               for (const item of response.data.collection.items) {
                 const data = {};
                 item.data.forEach(f => { data[f.name] = f.value; });
                 if (data.member_id && data.phone_number) {
                   phoneMap[data.member_id] = data.phone_number;
                 }
               }
             }
             return { success: true, phoneMap };
           } catch (error) {
             console.error('Error fetching member phones:', error.message);
             return { success: false, phoneMap: {} };
           }
         }

         /**
          * Get all organizations the authenticated user has access to
          */
         async getOrganizations() {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TeamSnap OAuth credentials not configured');
      }

      // Get OAuth access token
      const token = await this.getAccessToken();

      console.log('======================================');
      console.log('Fetching Organizations from TeamSnap');
      console.log('======================================');

      // Get organizations for the authenticated user
      const endpoint = `${this.baseURL}/me`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.collection+json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      console.log('======================================');
      console.log('TeamSnap /me Response:');
      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log('======================================');

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get teams the user has access to
      const teamsEndpoint = `${this.baseURL}/teams/search`;
      
      const teamsResponse = await axios.get(teamsEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.collection+json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      console.log('======================================');
      console.log('TeamSnap Teams Response:');
      console.log(`  Status: ${teamsResponse.status}`);
      console.log(`  Teams Found: ${teamsResponse.data?.collection?.items?.length || 0}`);
      console.log('======================================');

      if (teamsResponse.data && teamsResponse.data.collection && teamsResponse.data.collection.items) {
        const teams = teamsResponse.data.collection.items.map(item => {
          const data = {};
          item.data.forEach(field => {
            data[field.name] = field.value;
          });

          return {
            id: data.id,
            name: data.name || 'Unnamed Team',
            division_id: data.division_id,
            division_name: data.division_name,
            season_name: data.season_name,
            league_name: data.league_name,
            sport_name: data.sport_name,
            organization_id: data.organization_id,
            created_at: data.created_at,
            href: item.href
          };
        });

        // Group by organization
        const orgs = {};
        teams.forEach(team => {
          if (team.organization_id) {
            if (!orgs[team.organization_id]) {
              orgs[team.organization_id] = {
                id: team.organization_id,
                teams: []
              };
            }
            orgs[team.organization_id].teams.push(team);
          }
        });

        const organizations = Object.values(orgs).map(org => ({
          id: org.id,
          team_count: org.teams.length,
          teams: org.teams
        }));

        console.log(`✅ Found ${organizations.length} organization(s) with ${teams.length} total team(s)`);

        return {
          success: true,
          organizations: organizations,
          total_teams: teams.length,
          count: organizations.length
        };
      }

      return {
        success: true,
        organizations: [],
        count: 0,
        note: 'No organizations found'
      };

    } catch (error) {
      console.error('Error fetching organizations:', error.response?.data || error.message);
      return {
        success: false,
        error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * Get a specific registration form by ID
   */
  async getRegistrationForm(formId) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TeamSnap OAuth credentials not configured');
      }

      const token = await this.getAccessToken();

      console.log('Fetching registration form:', formId);
      
      const endpoint = `${this.baseURL}/registration_forms/${formId}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.collection+json'
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      console.log('Form response status:', response.status);
      console.log('Form data:', JSON.stringify(response.data, null, 2));

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.data && response.data.collection && response.data.collection.items && response.data.collection.items[0]) {
        const item = response.data.collection.items[0];
        const data = {};
        item.data.forEach(field => {
          data[field.name] = field.value;
        });

        return {
          success: true,
          form: data
        };
      }

      return {
        success: false,
        error: 'Form not found'
      };

    } catch (error) {
      console.error('Error fetching form:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get division information
   */
  async getDivision(divisionId) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TeamSnap OAuth credentials not configured');
      }

      const token = await this.getAccessToken();

      console.log('Fetching division info for:', divisionId);
      
      const endpoint = `${this.baseURL}/divisions/${divisionId}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.collection+json'
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.data && response.data.collection && response.data.collection.items && response.data.collection.items[0]) {
        const item = response.data.collection.items[0];
        const data = {};
        item.data.forEach(field => {
          data[field.name] = field.value;
        });

        console.log('Division data:', JSON.stringify(data, null, 2));

        return {
          success: true,
          division: data
        };
      }

      return {
        success: false,
        error: 'Division not found'
      };

    } catch (error) {
      console.error('Error fetching division:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all registration forms for an organization
   */
  async getRegistrationForms(organizationId) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TeamSnap OAuth credentials not configured');
      }

      // Get OAuth access token
      const token = await this.getAccessToken();

      console.log('======================================');
      console.log('Fetching Registration Forms from TeamSnap');
      console.log(`  Organization ID: ${organizationId}`);
      console.log('======================================');

      // Get registration forms for the organization
      const endpoint = `${this.baseURL}/registration_forms/search?organization_id=${organizationId}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.collection+json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      console.log('======================================');
      console.log('TeamSnap Registration Forms Response:');
      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log(`  Forms Found: ${response.data?.collection?.items?.length || 0}`);
      console.log('======================================');

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse the collection+json response
      if (response.data && response.data.collection && response.data.collection.items) {
        const forms = response.data.collection.items.map(item => {
          const data = {};
          item.data.forEach(field => {
            data[field.name] = field.value;
          });

          return {
            id: data.id,
            name: data.name || 'Unnamed Form',
            description: data.description || '',
            is_active: data.is_active,
            registration_starts_at: data.registration_starts_at,
            registration_ends_at: data.registration_ends_at,
            created_at: data.created_at,
            updated_at: data.updated_at,
            organization_id: data.organization_id,
            href: item.href
          };
        });

        console.log(`✅ Found ${forms.length} registration form(s)`);

        return {
          success: true,
          forms: forms,
          count: forms.length
        };
      }

      return {
        success: true,
        forms: [],
        count: 0,
        note: 'No registration forms found'
      };

    } catch (error) {
      console.error('Error fetching registration forms:', error.response?.data || error.message);
      return {
        success: false,
        error: `TeamSnap API error: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * Sync registrations from TeamSnap to local database
   */
  async syncRegistrationsToDatabase(database, teamId, season = null) {
    try {
      console.log(`Syncing TeamSnap registrations for team ${teamId}...`);

      const result = await this.getRegistrations(teamId, season);

      if (!result.success) {
        return result;
      }

      const imported = [];
      const errors = [];

      for (const registration of result.registrations) {
        try {
          // Check if player already exists
          const existing = await database.get(
            'SELECT id FROM tryout_registrations WHERE first_name = ? AND last_name = ? AND email = ? AND season = ?',
            [registration.firstName, registration.lastName, registration.email, registration.season]
          );

          if (existing) {
            console.log(`Player ${registration.firstName} ${registration.lastName} already exists, skipping`);
            continue;
          }

          // Insert new registration
          const insertResult = await database.run(
            `INSERT INTO tryout_registrations
             (first_name, last_name, email, phone, date_of_birth, parent_name, parent_email,
              age_group, season, source, external_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              registration.firstName, registration.lastName, registration.email,
              registration.phone, registration.dateOfBirth, registration.parentName,
              registration.parentEmail, registration.ageGroup, registration.season,
              registration.source, registration.externalId, registration.notes
            ]
          );

          imported.push({
            id: insertResult.id,
            name: `${registration.firstName} ${registration.lastName}`,
            ageGroup: registration.ageGroup
          });

        } catch (error) {
          console.error(`Error importing registration:`, error);
          errors.push(`Error importing ${registration.firstName} ${registration.lastName}: ${error.message}`);
        }
      }

      return {
        success: true,
        imported: imported.length,
        errors: errors.length,
        details: {
          imported,
          errors
        }
      };

    } catch (error) {
      console.error('Error syncing registrations to database:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TeamSnapAPI;

