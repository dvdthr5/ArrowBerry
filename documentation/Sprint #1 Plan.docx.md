**Sprint 1 Plan \- ArrowBerry rev. 1**

4/6/2026 \- 4/20/2026

 **Goal:** Short, 1-2 sentence description of the high-level goal(s) for the sprint. ∙

	Create the base repository and structure that will allow us to build out all of the necessary MVP features. 

 **Task listing, organized by user story:** This section lists the user stories, in priority order from  most important (top) to least important (bottom). Within each user story, there needs to be a  list of tasks required to implement the user story, along with the time estimate for each tasks (preferably less than or equal to 6 ideal hours). This should look like: 

User interface \- As a user, I want a nice soothing screen app to look at so that I am excited to use the app and be able to navigate all the features easily. 

* Set up React Native environment   
* Connect to Github Repo  
* Create base bar with Pantry page, receipt scanner page, and personal profile

	Total Time: (4 \+ 1 \+ 2\) \= 7 story points

SupaBase Auth \- As a developer, I would like to use Supabase as the database so that we can automatically handle user authentication and quickly access any needed information, like UserPreferences or RecipeRecommendations

* Task 1: Set up supabase cluster  
* Task 2: Configure login/register page that assigns userID that never changes  
* Task 3: (Possibly) Create second DB for recipes, so we have one user related db which holds userId, pantry info, saved recipes and one database which is all recipes along with the ingredients in the recipe

	Total Time: (2 \+ 5 \+ 2\) \= 9 story points

Camera scanner Page: As a shopper, I want to be able to take a picture of my receipt so that I don't have to type each ingredient I have into the app.

* Task 1 \- Implement a camera API so users can take photos and upload them to the app. (1)  
* Task 2 \- Have an OCR that will extract the text from the image(1)  
* Task 3 \- In case the OCR cannot read a certain part of the receipt, we use an LLM to further analyze the image and return the values.(2)  
* Task 4 \- The extracted text(could be JSON) is then sent via API endpoints to the database under the specific User ID.(3)  
* Task 5 \- The text is then displayed on the front end to the user. (visuals will be taken care of as well)(2)

 	Total Time: 1+1+2+3+2 \= 9 story points

Digital Pantry: As a cook, I want a way to be able to easily see the ingredients I have and the rough quantities so I can visualize my ingredients while away from home. 

* Task 1: Create Landing Page for digital pantry(2)  
* **Task 2: Grab all instances of receipt text from user id and add to pantry list(3)**  
* **Task 3: Display all the foods in a ‘Collecter’ style layout (SEE DISCORD)(5)**  
* Task 4: Add ‘delete/edit buttons’(2)  
* Task 5: Add ‘Add button’(2)

	Total Time: (2 \+ 3 \+ 5 \+ 2 \+ 2\) \= 14 story points

Storing previous data: As a developer, I want the recipes, nutrition info, and meal history in the database so that features have somewhere to access prior data.

	Recipe Recommendation: As someone who loves to eat but isn’t a great cook, I want a way to be able to see all the recipes I could make from the items that I already have in my house, so that I can cook nice meals while utilizing what I already have. 

* Task 1: Create algorithm to display possible recipes using only items in pantry (8 story points)  
* Task 2: Create buttons for like/dont like food and store preferences  
* Task 3: Create an algorithm that combines possible recipes with user preferences to make recommendations personal

	Total Time: (8 \+ 2 \+ 6\) \= 16 story points

∙ **Team roles:** 

* Servesh: Product Owner  
* David: SCRUM Master  
* Nikhil: Team Member   
* Akhilesh: Team Member 


  ∙ **Initial task assignment:** 


* Nikhil and Servesh: User Interface initial app framework \[SET UP REACT ENVIRONMENT\]  
* David: Supabase Creation and integration \[Create cluster, create login page, verify user info\]  
* Akhilesh: Camera Scanner  \[get model to extract text from a receipt image, camera portion not as important right now\], get familiar with csv format 

  **∙ Initial burnup chart: A graph giving the initial burnup chart for this sprint and is labeled as such  with sprint number and project name and is located in the lab.** 


  

| USER STORY | TO DO | WORKING | DONE |
| :---- | :---- | :---- | :---- |
| USER INTERFACE | CREATE REACT ENVIRONMENT CONNECT GITHUB REPO CREATE BASE LAYOUT FOR APP |  |  |
| SUPABASE | CREATE CLUSTER INTEGRATE CLUSTER INTO APP LOGIN PAGE  |  |  |
| AKHILESH | CREATE/FIND OCR MODEL TURN RECEIPT IMAGE INTO CSV FILE CREATE ENDPOINT WHERE  IMAGE UPLOADS AND OUTPUTS CSV |  |  |


  ∙ **Scrum times:** 

* Monday 9:05am-9:20am  
* Wednesday 9:05am-9:20am  
* Friday 9:05am-9:20am

