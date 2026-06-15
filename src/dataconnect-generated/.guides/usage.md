# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUser, createBooking, listMyBookings, searchFlights } from '@dataconnect/generated';


// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);

// Operation CreateBooking:  For variables, look at type CreateBookingVars in ../index.d.ts
const { data } = await CreateBooking(dataConnect, createBookingVars);

// Operation ListMyBookings: 
const { data } = await ListMyBookings(dataConnect);

// Operation SearchFlights:  For variables, look at type SearchFlightsVars in ../index.d.ts
const { data } = await SearchFlights(dataConnect, searchFlightsVars);


```