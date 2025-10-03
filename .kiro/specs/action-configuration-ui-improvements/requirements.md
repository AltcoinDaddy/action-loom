# Requirements Document

## Introduction

The current action configuration interface in ActionLoom is not intuitive for users. When users drag actions onto the canvas, they cannot easily find or access the configuration panel to set parameters like recipient addresses, token types, and amounts. This creates a poor user experience and prevents users from successfully completing their workflows. This feature will redesign and improve the action configuration UI to make it more discoverable, accessible, and user-friendly.

## Requirements

### Requirement 1

**User Story:** As a workflow builder user, I want to easily identify which actions need configuration, so that I can complete my workflow setup without confusion.

#### Acceptance Criteria

1. WHEN an action is dragged onto the canvas THEN the system SHALL display a visual indicator showing the action requires configuration
2. WHEN an action has missing required parameters THEN the system SHALL show a warning badge or icon on the action node
3. WHEN an action is fully configured THEN the system SHALL display a success indicator on the action node
4. WHEN hovering over an unconfigured action THEN the system SHALL show a tooltip indicating "Click to configure parameters"

### Requirement 2

**User Story:** As a workflow builder user, I want multiple clear ways to access action configuration, so that I can easily set up my actions regardless of my interaction preference.

#### Acceptance Criteria

1. WHEN clicking on an action node THEN the system SHALL open the parameter configuration panel
2. WHEN right-clicking on an action node THEN the system SHALL show a context menu with "Configure" option
3. WHEN double-clicking on an action node THEN the system SHALL open the parameter configuration panel
4. WHEN an action is first added to canvas THEN the system SHALL automatically open the configuration panel
5. WHEN the configuration panel is open THEN the system SHALL highlight the corresponding action node

### Requirement 3

**User Story:** As a workflow builder user, I want a clear and intuitive parameter configuration interface, so that I can easily understand what information is required and how to provide it.

#### Acceptance Criteria

1. WHEN the configuration panel opens THEN the system SHALL display a clear title showing the action name
2. WHEN showing parameter fields THEN the system SHALL provide descriptive labels and help text for each field
3. WHEN a parameter is required THEN the system SHALL mark it with a visual indicator (asterisk or "Required" label)
4. WHEN a parameter has validation rules THEN the system SHALL show format examples or constraints
5. WHEN a user enters invalid data THEN the system SHALL show inline validation errors
6. WHEN all required fields are completed THEN the system SHALL enable the "Save" button
7. WHEN clicking "Save" THEN the system SHALL close the panel and update the action node visual state

### Requirement 4

**User Story:** As a workflow builder user, I want helpful guidance and examples for parameter values, so that I can configure actions correctly without external documentation.

#### Acceptance Criteria

1. WHEN configuring address fields THEN the system SHALL provide example addresses in the correct format
2. WHEN configuring token amounts THEN the system SHALL show decimal format examples and validation
3. WHEN configuring token types THEN the system SHALL provide a dropdown with available options
4. WHEN a field has specific format requirements THEN the system SHALL show format hints below the input
5. WHEN hovering over a help icon THEN the system SHALL display detailed parameter explanations

### Requirement 5

**User Story:** As a workflow builder user, I want to see the configuration status of all actions in my workflow, so that I can identify incomplete setups at a glance.

#### Acceptance Criteria

1. WHEN viewing the workflow canvas THEN the system SHALL show configuration status for each action node
2. WHEN an action is unconfigured THEN the system SHALL display it with a distinct visual style (e.g., dashed border, warning color)
3. WHEN an action is configured THEN the system SHALL display it with a complete visual style (e.g., solid border, success color)
4. WHEN building a workflow THEN the system SHALL show a progress indicator for overall configuration completeness
5. WHEN attempting to execute an incomplete workflow THEN the system SHALL prevent execution and highlight unconfigured actions

### Requirement 6

**User Story:** As a workflow builder user, I want to easily modify existing action configurations, so that I can iterate and refine my workflows efficiently.

#### Acceptance Criteria

1. WHEN clicking on a configured action THEN the system SHALL open the configuration panel with current values pre-filled
2. WHEN modifying configuration values THEN the system SHALL preserve other existing settings
3. WHEN canceling configuration changes THEN the system SHALL revert to the previous values
4. WHEN saving configuration changes THEN the system SHALL update the action node and show confirmation
5. WHEN configuration is modified THEN the system SHALL update any dependent validation or workflow status