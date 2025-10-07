/**
 * Test Data Generator
 * Provides realistic test data using Faker
 */

import faker from 'faker';

export const generateTestUser = () => ({
  email: faker.internet.email(),
  name: faker.name.findName(),
  phoneNumber: faker.phone.phoneNumber('010-####-####'),
  birthDate: faker.date.past(30, new Date('2000-01-01')).toISOString().split('T')[0],
  gender: faker.random.arrayElement(['male', 'female']),
  nickname: faker.internet.userName(),
  marketingConsent: faker.datatype.boolean()
});

export const generateTestShop = () => ({
  name: `${faker.company.companyName()} 뷰티샵`,
  description: faker.lorem.paragraph(),
  address: faker.address.streetAddress(),
  phoneNumber: faker.phone.phoneNumber('02-####-####'),
  email: faker.internet.email(),
  category: faker.random.arrayElement(['헤어', '네일', '피부', '왁싱', '속눈썹'])
});

export const generateTestReservation = (userId: string, shopId: string, serviceId: string) => ({
  userId,
  shopId,
  serviceId,
  reservationDate: faker.date.future().toISOString().split('T')[0],
  reservationTime: `${faker.datatype.number({ min: 9, max: 18 })}:00`,
  notes: faker.lorem.sentence()
});

export const generateTestPayment = (reservationId: string, amount: number) => ({
  reservationId,
  amount,
  method: faker.random.arrayElement(['card', 'transfer', 'cash']),
  status: 'pending'
});

export const generateReferralCode = () => {
  return faker.random.alphaNumeric(8).toUpperCase();
};
