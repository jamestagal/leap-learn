New Content Look and Feel
 Joan Roa
16 days ago Updated
Not yet followed by anyone
Interactive content like never before. With our latest release, you can create H5Ps in a modern, fresh, and more customizable way.

We've updated how H5P looks and feels with our new look and feel, completely revamping the design of our different content types, making the already engaging interactives even more engaging. To learn which content types support the new design, visit this help article: List of content types with the new look and feel.

Organizations now may choose between prebuilt themes or create their own from scratch in a completely painless way in just a few steps. All preestablished themes are WCAG 2.0 AA compliant, ensuring sufficient color contrast and accessibility.

Adjusting color schemes and density is now smooth, giving more flexibility to your H5Ps. Subtle UX improvements, such as new appearances for Submit and Check buttons as well as drag-and-drop animations and larger tap zones, also enhance usability, particularly on mobile devices. To learn more in-depth about these updates, visit this link: Changes in H5P components.

 

The new look and feel topics
What's new
Visibility
Theme
Density
After saving the settings
Visual demonstration
Known limitations
FAQs
 

What's new: 
Now, within the Organization Settings, as an admin, you will be presented with an entirely new setting called Content look and feel settings. 

 


Visibility
Here, you can enable the new look and decide which user level can view it. Allowing you to test the themes before releasing the changes to the entire organization. Here's what can be done:

Off – Disabled for all users
Admins only (you) – Visible only to admins for testing and preview. Can be especially useful when testing Custom CSS. 
Everyone – Visible to all users, including learners
Important: The Visibility settings will only be available for existing organizations and will be set to Off by default. For organizations created after the release, only the new theme will be enabled, being the default theme for everyone. 

Theme
You may also choose from our preestablished color schemes (all WCAG 2.0 AA color contrast approved): Daylight (default), Mint, or Sunset. Alternatively, you may create your own custom theme by choosing which elements you wish to be in which color, including buttons, navigation, backgrounds, and answer spaces.

Theme selector
 

Density
It is also possible to choose the density of the content, meaning how tightly the elements or components within an H5P will be displayed. For best readability, we'll recommend the Wide view. 

Please note that some content types with fixed height, such as Course Presentation or Drag and Drop, may not fully reflect density changes.

Density selector
 

After saving the settings
Once your theme and density settings are applied, all existing content and supported content types will display with the new theme—including content inside LMSs (Brightspace, Canvas, Moodle, Blackboard, etc.) and content created via Smart Import and Layout Builder.

Your content should look something like this:

Drag the Words with the New Look and Feel
 

We believe that with the new look and feel, content creators will have a wider range of what can be achieved with the tool, as well as make the interactives more engaging for their viewers. 

 

Visual demonstration
Here's a visual demo of what you, as an H5P admin, can expect to see before and after the changes, as well as how to enable the new look and feel:

H5P before and after the New Look and Feel
 

Here's what your students will see after you enable the new look and feel:

H5P with the New Look and Feel in Brightspace
 

Known limitations
These are the current known limitations: 

Chase and Multipoll remain in the legacy design, and the subcontent will not adopt the new theme in this initial release. Future updates may expand support.
Branching Scenario and Game Map display subcontent with the new theme, while the container remains in the legacy design. Minor visual differences may appear.
Density settings do not apply to content types like Course Presentation and Drag and Drop, since they allow for element resizing. 
 

FAQs
Q: Can authors access the new theme settings?
A: No, only admins have access.

Q: When will my users see the new theme?
A: Immediately. Once the theme is set as the default for everyone, any supported H5P opened will display the new look.

Q: Can I opt out of the new theme?
A: Existing customers, created before this release, can deactivate it initially, but it will become the default in the future.

Q: Will this only be available in H5P.com?
A: This will be supported in H5P.com as well as in the OER Hub (with the Daylight theme default), with the plan of enabling this in the Plugins too.

Q: Will I still be able to use Custom CSS?
A: Yes, you can find out more about how this is expected to work here: Custom CSS issues with the new look and feel

List of content types with new look and feel
 Joan Roa
12 days ago Updated
Not yet followed by anyone
With the new look and feel, you and your students will experience H5Ps like never before. 

Now, all of the content types that can be included in an Interactive Book, including the Interactive Book itself, will display the new look and feel at launch. 

Supported content types at launch
The following content types are currently upgraded:

Accordion
Audio Recorder
Chart
Collage
Course Presentation
Dialog Cards
Documentation Tool
Drag and Drop
Drag the Words
Essay (Third-party contribution)
Fill in the Blanks
Find the Hotspots
Flashcards
Guess the Answer
Image Hotspots
Image Slider
Interactive Book
Interactive Video
Mark the Words
Memory Game
Multimedia Choice (previously named Image Choice)
Multiple Choice
Page (previously named Column)
Question Set
Single Choice Set
Summary
True/False
Note: In addition to the content types listed above, Text, Table, Video, Audio, and Link (used as sub-content within other activities) are also supported in this release.

Content types not yet upgraded
The remaining content types will be updated gradually. This approach is intended to ensure a smooth transition and give you time to prepare for each change. You’ll be notified through our newsletter or release notes when these updates are released.

Once the new look and feel is fully rolled out, the legacy theme will no longer be available. We’ll notify you ahead of time before this change takes effect.

Third-party and non-recommended content types
All content types available on H5P.com will eventually be upgraded to the new look and feel, including non-recommended and third-party content types. For example, the Essay content type, which is a third-party contribution, will also be upgraded to the new design.

Changes in H5P components
With the new look and feel of H5P, some familiar elements or components within activities will have a different look. The new look and feel brings:

Cleaner, more contemporary styling with simplified shapes and fewer heavy borders

Neutral default color palette designed to work with institutional branding

Improved typography and spacing for better readability, especially for mobile usage

More consistent layouts for titles, instructions, and activity content

The following sections explain what we've changed for the learner UI and what you may want to review in your internal H5P documentation.

Standardized buttons
Overall, learner interactives have been updated to be better aligned across our content types. This means that clickable elements, submit, check, show solution, retry buttons, and next and previous navigations are now more consistent. 

Screenshot 2026-01-29 at 13.15.14.png
Screenshot 2026-01-29 at 13.15.34.png
 

Before: In the old design, clickable elements had a different color and contrast scheme. As well as a default destiny, sometimes elements being more packed together.	After: Color and contrast are now standardized, as well as density thanks to the new look and feel settings.
 

db0cef6a-8c90-4888-9630-94e060634d4f.png
94d54c3b-9143-4f44-8482-257d1a6c2f7b.png
Before: Common controls like Check and Show solution used buttons that varied slightly between content types.	After: Common buttons such as Check and Show solution now share a consistent, theme‑colored style across updated content types, making them easier for learners to recognize.
 

Effect on your documentation
Any screenshots in your documentation that show the old design (older buttons, icons, borders, or fonts) will no longer match what learners see. Plan to replace learner‑view screenshots over time.

 

Cards, items, and summary screens
Many of our content types use cards and summary or result screens. On this update, we've also made sure these elements follow the same patterns. 

Screenshot 2026-01-29 at 13.42.30.png
Screenshot 2026-01-29 at 13.39.19.png
Before: Card-based activities had a varying appearance of cards.	After: Card‑based activities in the new look and feel use cleaner cards, clearer typography, and more consistent icons.
 

Screenshot 2026-01-29 at 13.55.25.png
Screenshot 2026-01-29 at 13.55.11.png
Before: Summary screens varied more between content types, with denser layouts and less visual separation between results and navigation.	After: Updated summary screens present scores, feedback, and next steps in a more consistent layout with clearer headings, spacing, and buttons.
 

Effect on your documentation
If your documentation describes unique summary layouts for specific content types, expect these to be more similar now. You can describe a general “summary screen” pattern and note only important differences.

Interaction and usability improvements
The new look and feel introduces subtle usability enhancements, especially for touch devices. 

Screenshot 2026-01-29 at 14.05.17.png
Screenshot 2026-01-29 at 14.03.18.png
Before: Drag‑and‑drop activities didn’t use drag handles and had less distinct drop zones, which could be harder to use on touch devices.	After: Drag‑and‑drop activities benefit from clearer drag handles, and more visible hover feedback, especially helpful for learners on tablets and phones.
Effect on your documentation
If your documentation warns about small clickable areas or awkward drag‑and‑drop behavior, those notes may now be outdated and can usually be removed or simplified.

Progress indicators
We've also implemented some changes to content types, which have several steps to complete or have a progress bar. 

Screenshot 2026-01-29 at 14.13.37.png
Screenshot 2026-01-29 at 14.13.24.png
Before: Progress indicators weren't consistent among content types nor super intuitive.	After: Now the progress indicator bar is consistent in our content types and more intuitive.
Screenshot 2026-01-29 at 14.17.58.png
Screenshot 2026-01-29 at 14.17.49.png
Before: Interactive Videos playbar didn't match our legacy theme.	After: Elements within the Interactive Video have been updated to match the new look and feel.
 Custom CSS issues with the new look and feel
 Joan Roa
23 days ago Updated
Not yet followed by anyone
With the new look and feel, Custom CSS will continue to be supported.

Our goal remains to be a platform for creating engaging content, and allowing users to adjust activities to their learners is a priority for us. Thanks to our Custom CSS, organizations can apply their own styling when needed, with some limitations.

Now, together with the new look and feel, you'll have more control over how you wish for your content to look. But there are a few key details to keep in mind. 

In this document, we’ll cover:

Recommended CSS and the new look and feel workflow for admins
Step by step
Existing CSS that might break
Custom color overrides in content types
 

Recommended CSS and the new look and feel workflow for admins 
If you’re already using Custom CSS, parts of your styling may conflict with the new look and feel. So to safely test your CSS, we recommend using the setting for Admin Only in the Content Look & Feel to preview your code. This will allow you to see how your Custom CSS behaves without interfering with your learners' or authors' progress.

Once you're happy with the CSS you've added and how it behaves with the new theme, you can go ahead and enable the Content Look and Feel for Everyone.

Here is the recommended workflow: 

Step by step
Step 1 — Enable the new look and feel for Admin Preview
Go to Settings → Manage Organization → Content Look & Feel and set Visibility to Admins only.
Step 2 — Review H5P Content using Custom CSS
Open an old H5P content that uses Custom CSS and review it after the new look and feel has been enabled. You may notice some issues with element alignment or the colors selected here. 
Step 3 — Update Custom CSS, if needed
Open the Custom CSS editor, using only the preview panel, and update the code to match the new look and feel theme.
Step 4 — Validate that the Custom CSS behaves correctly with the new look and feel
Confirm content displays correctly, and that it is readable, consistent, and aligned with your branding.
Step 5 — Publish to Everyone. Important: Wrong order of this step may result in students temporarily seeing broken activities. 
Go to Settings → Manage Organization → Content Look & Feel and change Visibility to Everyone.
Then go to Settings → Manage Organization → Custom CSS, push CSS from Preview → Live, and save.
 

Existing CSS that might break
With the new look and feel, we've introduced some changes in our code, which may result in some Custom CSS being overridden, style or theme conflicts, and, in some cases, the UI may be inconsistent or broken. 

In detail, here are the changes we made:

New class names
Updated layout spacing
Modernized UI components
 

Color overrides in content types settings
Some content types, such as Memory Game and Interactive Book, include some color options within the behavioral settings for elements within them. When an author applies custom colors within these content types, those colors will override the main color defined by the selected theme in the new look and feel, but not the Custom CSS.

Download or Copy H5P Content Using the Reuse Button
 Joan Roa
4 months ago Updated
Not yet followed by anyone
In this guide, you'll learn different ways in which you can reuse content, such as:

How to download an H5P
How to upload an H5P
How to Copy/Paste an H5P
Known Limitations
Importante: Para leer la versión en español, visita Descargar o Copiar contenido H5P usando el botón de Reusar.
How to download an H5P
Administrators may enable the "Reuse button" in H5P settings, and authors may toggle this button for each H5P content. If this button is enabled, users may download an H5P when viewing it by clicking the reuse button in the bottom left corner of the H5P.

To try this out, follow these steps:

Go to https://h5p.org/multichoice
Step 1: Click the "Reuse" button in the bottom left corner of the H5P.
Step 2: A popup will open. Click "Download as a .h5p file".
A file should be downloaded to your computer.
 
file-5d00ea6a5936e.png
 
Notes:

You are able to download H5P content from any site where the "Reuse" button is available and upload it to any site supporting H5P.
Enable the "Reuse" button under "Display options".
 
file-6006a1537be02.png
 
How to upload an H5P
Step 3: Click the "Add content" button above the content list.
 
file-5d00fcd5b2afc.png
 
Step 4: In the H5P authoring tool, switch the tab from "Create content" to "Upload".
Step 5: Click on the file chooser and select the file that you just downloaded.
 
file-5d00fdb316145.png
 
Step 6: Click "Use". This will load the .h5p file into the H5P authoring tool.
 
file-5d00fdb83a58c.png
 
Step 7: Click "Save".
Your content is now uploaded and ready to be viewed!
 
file-5d00fdbe07387.png
 
How to Copy/Paste an H5P
If you've created an exciting H5P, it should be easy to paste it into another content (or pieces of existing content) by using our Copy and Paste feature. This feature proves useful with H5Ps that allow several content types to be added within it, for example, Interactive Book or The Chase. 

Below is an example of how this can be done.

Copying of existing content

Open content that you want to copy.
Step 1: Click the "Reuse" button in the bottom left corner of the H5P.
Step 2: A popup will open. Click "Copy content".
 
file-5d00f19e63680.png
 
Copying of a piece of content

You can also copy just a piece of content. To do so:

Open the content you want to copy.
Find a block of content you want to copy and click the "Copy" button in the top right corner of the content block.
 
file-5d01036f849bf.png
 
Pasting

Step 3: If you want to paste inside a WYSIWYG editor (like Interactive Video or Course presentation) use the "Paste button" in the top right corner.
You can also use the CTRL+V keys.
 
file-5d00fe7186f5d.png
 
Step 3: If you want to paste inside a generic editor, use the "Paste and replace" button in the top right corner of each block.
The "Paste and replace" button will replace the current block with H5P content from a clipboard.
Note: If you replace existing content, the existing content will be lost. If you do not want to lose any content, add a new block and then click "Paste".

 
file-5d0104f326040.png
Known Limitations
It is currently not possible to bulk download or upload H5Ps, meaning that users will need to manually download and reupload each of their activities. 

