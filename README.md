🔍 Salesforce LogHunt(Works on Lightning and classic)

A Premium Salesforce Debug Log Searcher Extension
Salesforce LogHunt is a high-performance Chrome Extension designed for Salesforce Developers and Admins. It simplifies the tedious process of searching through hundreds of Apex Debug Logs by providing a sleek, integrated UI that finds exactly what you're looking for in seconds.
<img width="499" height="620" alt="image" src="https://github.com/user-attachments/assets/c2b1fc15-4167-4e2d-b2b0-83ab6a58a083" />

✨ Features
Lightning Optimized: Specifically engineered to pierce through Salesforce Lightning iframes to highlight logs directly in the Setup UI.

Smart API Integration: Uses the Salesforce Tooling API to fetch log bodies sequentially, ensuring you never hit org concurrency limits.

Compact & Non-Intrusive: A sleek, draggable interface that stays out of your way while you work.

Secure & Private: 100% client-side execution. Your session IDs and log data never leave your browser.

🚀 Installation
Since this is a custom internal tool, you can install it via Developer Mode:

* Download/Clone this repository to your local machine.

* Open Google Chrome and navigate to chrome://extensions/.

* Enable Developer mode using the toggle in the top-right corner.

* Click the Load unpacked button.

* Select the folder containing the extension files.

* Pin the extension to your toolbar by clicking the puzzle piece icon.

🛠 How to Use
* Navigate to Setup → Debug Logs in your Salesforce Org.

* Click the Salesforce LogHunt icon (the Orange Bug) in your Chrome toolbar.

* Enter your keyword (Class Name, Record ID, Method, etc.).

* Select how many recent logs you want to scan (20, 50, 100, or 200).

* Hit Search Logs.

* Salesforce LogHunt will scan the logs and automatically:

* Highlight matching rows in Orange.

* Add a Match Count badge to the row.

* Scroll the first match into view.

🔒 Security & Performance
Org Limits: The script includes a built-in FETCH_DELAY to prevent hitting API rate limits. It is safe for use in production and large sandboxes.

Data Privacy: No external servers are used. All fetch calls are made to your current Salesforce instance using your existing session.

Zero-Footprint: Once the panel is closed or the page is refreshed, all injected elements are removed from the DOM.

👨‍💻 Developed By
Ankit Patel
ankit.ap.patel01@gmail.com

"Awaiating for response on enachement or the bugs you found."
“Crafted for engineers who value speed, precision, and a clean UI.”



