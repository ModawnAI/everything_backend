// Comprehensive Faker mock for testing
export const faker = {
  datatype: { 
    uuid: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    number: (options = {}) => options.min ? Math.floor(Math.random() * (options.max - options.min + 1)) + options.min : Math.floor(Math.random() * 1000),
    boolean: () => Math.random() > 0.5,
    float: (options = {}) => options.min ? Math.random() * (options.max - options.min) + options.min : Math.random() * 100,
    datetime: () => new Date()
  },
  date: { 
    future: () => new Date(Date.now() + 86400000),
    recent: () => new Date(Date.now() - 86400000),
    past: () => new Date(Date.now() - 172800000),
    between: () => new Date(Date.now() - 86400000),
    soon: () => new Date(Date.now() + 3600000)
  },
  lorem: { 
    words: (count = 3) => Array(count).fill(0).map(() => 'test').join(' '),
    sentence: () => 'This is a test sentence.',
    paragraph: () => 'This is a test paragraph with multiple sentences.'
  },
  internet: { 
    email: () => 'test@example.com',
    url: () => 'https://example.com',
    ip: () => '192.168.1.1'
  },
  name: { 
    firstName: () => 'Test', 
    lastName: () => 'User',
    fullName: () => 'Test User',
    findName: () => 'Test User'
  },
  phone: { 
    number: () => '010-1234-5678',
    phoneNumber: () => '010-1234-5678'
  },
  address: {
    city: () => 'Seoul',
    streetAddress: () => '123 Test St',
    zipCode: () => '12345'
  },
  company: {
    name: () => 'Test Company'
  },
  commerce: {
    productName: () => 'Test Product',
    price: () => 10000
  }
};

export default faker;
