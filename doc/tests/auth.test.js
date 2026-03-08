import axios from 'axios';
import { describe, it, expect } from '@jest/globals';

describe('User Authentication', () => {
  it('should register a new user', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
    };

    try {
      const response = await axios.post('/api/register', userData);
      expect(response.status).toBe(201);
    } catch (error) {
      console.error(error);
      expect.fail('Registration failed');
    }
  });

  it('should login an existing user', async () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    try {
      const response = await axios.post('/api/login', loginData);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('jwt');
    } catch (error) {
      console.error(error);
      expect.fail('Login failed');
    }
  });

  it('should retrieve user information', async () => {
    // Assuming we have a JWT from a previous login
    const jwt = 'your_jwt_token';

    try {
      const response = await axios.get('/api/me', {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
    } catch (error) {
      console.error(error);
      expect.fail('Failed to retrieve user information');
    }
  });
});
