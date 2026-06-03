**Test Plan and Report, ArrowBerry 5/14**  
User Story 1: Camera Scanner Page (\_\_tests\_\_/scanner/ScannerScreen.test.js)  
Test: Scanner screen renders without crashing (Pass/Fail)

1. Open scanner page  
2. The user should be able to see through the devices camera

Test: User can request camera permission (Pass/Fail)

1. Open scanner screen without camera permissions  
2. Press Permission button  
3. User should be prompted to give permission to app  
4. User should be able to see out of camera after clicking accept

Test: User can capture a receipt image

1. Open scanner page  
2. Press take photo  
3. Camera should take photo and prompt user to press check mark to extract text  
4. App should capture photo and send to model for extraction after check mark  
   

User Story 2: Login Page/Register Page (\_\_tests\_\_/auth/[LoginScreen.test.js](http://LoginScreen.test.js) & \_\_tests\_\_/auth/RegisterScreen.test.js)  
Test: User can sign in with entered email and password (Pass/Fail)

1. Start app and go to login screen  
2. Input email “[test@example.com](mailto:test@example.com)” password “password123”  
3. Press sign in  
4. User should see a confirmation and be redirected to the scanner homepage

Test: User can create account with entered information (Pass/Fail)

1. Start app and go to register screen  
2. Input name “Test User” email “[test@example.com](mailto:test@example.com)” password “password123”  
3. Press Create account button  
4. User should see a confirmation message or rejection message

Test: User cannot make a second account under the same email

1. Start app and go to register screen  
2. Input name “Test User” email “[test@example.com](mailto:test@example.com)” password “password123”  
3. Press create account button  
4. User should see a message that the creation failed. 

User Story 3: Digital Pantry Page (\_\_tests\_\_/pantry/PantryScreen.test.js)  
Test: User can view saved pantry items (Pass/Fail)

1. Open pantry screen  
2. Create mock object “Item \= Apples, Quantity \= 4, Unit \= Pcs, Category \= Produce”  
3. User should be able to see card for 4 Apple Pcs, Produce  
   

Test: User sees empty pantry message when no items exist (Pass/Fail)

1. Open pantry screen  
2. User should be able to see message “Your pantry is empty, Tap \+ to add your first item”

Test: User cannot save nameless pantry items

1. Open pantry page  
2. Click ‘+’ button  
3. Press save  
4. User should see alert “missing info, please enter item name”

Test: User can manually add a pantry item

1. Open Pantry Screen  
2. Press ‘+’ button  
3. Input name “chicken”, quantity “2”, unit “kg”, expiration date “2026-05-01”, category “meat”  
4. User should be able to see item in pantry “2 Kg Chicken, expiry date 2026-05-01, meat”  
   

Test: User can delete a pantry item (Pass/Fail)

1. Open pantry screen, where item “apples, 2” exists  
2. Press delete button  
3. The app should delete the selected item

User Story: Recipes (\_\_tests\_\_/recipes/RecipeScreen.test.js)  
Test: user can view recommended recipes based on pantry items (Pass/Fail)

1. Open recipe screen while signed in, with objects in your pantry “chicken”, “rice”  
2. Recipe page should display recipes that include both, “Chicken Rice Bowl”, and “Pasta Salad”  
   

Test: User can open a recipe and view details (Pass/Fail)

1. Open recipes screen  
2. Press “Chicken Rice Bowl”  
3. User should be able to see description, ingredient list, instructions  
4. Recipe ingredients should return “1 cup rice, 1 lb chicken”

Test: User can save a recipe to their profile (Pass/Fail)

1. Open recipes screen while signed in  
2. Press “Chicken Rice Bowl”  
3. Press save to profile button  
4. User should be able to see saved recipe in profile saved recipes section

Test: User can add missing recipe ingredients to shopping list (Pass/Fail)

1. Open recipes screen while signed in  
2. Press chicken rice bowl  
3. Press add missing ingredients button  
4. User should be able to see the missing ingredients in the shopping list (on pantry page)

