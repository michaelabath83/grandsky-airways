import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Airport_Key {
  id: UUIDString;
  __typename?: 'Airport_Key';
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: 'Booking_Key';
}

export interface CreateBookingData {
  booking_insert: Booking_Key;
}

export interface CreateBookingVariables {
  flightId: UUIDString;
  seatNumber: string;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  email: string;
  fullName: string;
}

export interface Flight_Key {
  id: UUIDString;
  __typename?: 'Flight_Key';
}

export interface ListMyBookingsData {
  bookings: ({
    status: string;
    bookingDate: TimestampString;
    flight: {
      flightNumber: string;
      departureTime: TimestampString;
      departureAirport: {
        cityName: string;
      };
      arrivalAirport: {
        cityName: string;
      };
    };
  })[];
}

export interface Passenger_Key {
  id: UUIDString;
  __typename?: 'Passenger_Key';
}

export interface SearchFlightsData {
  flights: ({
    flightNumber: string;
    price: number;
    departureTime: TimestampString;
    arrivalTime: TimestampString;
  })[];
}

export interface SearchFlightsVariables {
  departure: string;
  arrival: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateBookingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingVariables): MutationRef<CreateBookingData, CreateBookingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateBookingVariables): MutationRef<CreateBookingData, CreateBookingVariables>;
  operationName: string;
}
export const createBookingRef: CreateBookingRef;

export function createBooking(vars: CreateBookingVariables): MutationPromise<CreateBookingData, CreateBookingVariables>;
export function createBooking(dc: DataConnect, vars: CreateBookingVariables): MutationPromise<CreateBookingData, CreateBookingVariables>;

interface ListMyBookingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyBookingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyBookingsData, undefined>;
  operationName: string;
}
export const listMyBookingsRef: ListMyBookingsRef;

export function listMyBookings(options?: ExecuteQueryOptions): QueryPromise<ListMyBookingsData, undefined>;
export function listMyBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyBookingsData, undefined>;

interface SearchFlightsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SearchFlightsVariables): QueryRef<SearchFlightsData, SearchFlightsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SearchFlightsVariables): QueryRef<SearchFlightsData, SearchFlightsVariables>;
  operationName: string;
}
export const searchFlightsRef: SearchFlightsRef;

export function searchFlights(vars: SearchFlightsVariables, options?: ExecuteQueryOptions): QueryPromise<SearchFlightsData, SearchFlightsVariables>;
export function searchFlights(dc: DataConnect, vars: SearchFlightsVariables, options?: ExecuteQueryOptions): QueryPromise<SearchFlightsData, SearchFlightsVariables>;

