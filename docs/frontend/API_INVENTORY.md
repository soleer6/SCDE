# API inventory (generated)

Source: backend repo `anxoCRuam/SCDEE` branch `backend` @ a8eb9f43 (2026-05-19), file `docs/files/spectacular/SCDEE API.yaml`.
Regenerate with `scripts/analyze/endpoints.py` and `scripts/analyze/schemas.py` (need PyYAML). All paths below are relative to `/api/v1`.

**Never use an endpoint or field that is not listed here.** If you need one, write it in docs/coordination/REQUESTS.md.

## Endpoints
```
SCDEE API 1.0.0
security schemes: ['BearerAuth']
PUT    /annotations/{annotation_pk}/                                   [Annotations] req=form-data:UpdateAnnotationRequest resp=200:AnnotationResponse | Update annotation (RF-10.2) owner or OrgManager
DELETE /annotations/{annotation_pk}/                                   [Annotations] req= resp=204 | Delete annotation (RF-10.3) owner or OrgManager
POST   /annotations/{annotation_pk}/ocr/                               [Annotations] req= resp=200:OCRStylusResponse | OCR stylus to text (RF-9.13)
POST   /annotations/{annotation_pk}/ocr-grade/                         [Annotations] req= resp=200:OCRGradeResponse | OCR grade extraction (RF-9.12)
DELETE /assignment-rules/{rule_pk}/                                    [Grading] req= resp=204 | Delete rule (RF-8.3) 'can_assign_correctors' required
GET    /audit-logs/                                                    [Audit] req= resp=200:PaginatedAuditLogList | Retrieve audit logs (RF-16.2)
POST   /auth/login/                                                    [Authentication] req=json:LoginRequestRequest resp=200:TokenPairResponse | Authenticate with email and password (RF-1.2)
POST   /auth/logout/                                                   [Authentication] req=json:LogoutRequestRequest resp=204 | Revoke refresh token (RF-1.4)
POST   /auth/refresh/                                                  [Authentication] req=json:RefreshRequestRequest resp=200:TokenPairResponse | Rotate the refresh token (RF-1.3)
GET    /config/                                                        [Organizations] req= resp=200:OrgConfig | Get org config (RF-15.1)
PATCH  /config/                                                        [Organizations] req=json:PatchedOrgConfigRequest resp=200:OrgConfig | Update org config (RF-15.2)
POST   /courses/                                                       [Courses] req=json:CreateCourseRequest resp=201:Course | Create academic course
GET    /courses/{id}/                                                  [Courses] req= resp=200:Course | Retrieve course details
PATCH  /courses/{id}/                                                  [Courses] req=json:PatchedUpdateCourseRequest resp=200:Course | Update course
GET    /courses/current/                                               [Courses] req= resp=200:Course | Retrieve current course details
GET    /exams/{exam_pk}/                                               [Exams] req= resp=200:ExamFull | Exam detail (RF-6.13)
PATCH  /exams/{exam_pk}/                                               [Exams] req=json:PatchedUpdateExamRequest resp=200:ExamFull | Update exam (RF-6.2) 'can_create_exams' required
DELETE /exams/{exam_pk}/                                               [Exams] req= resp=204 | Delete exam (RF-6.3) 'can_create_exams' required
GET    /exams/{exam_pk}/assignment-rules/                              [Grading] req= resp=200:array | List rules 'can_assign_correctors' required
POST   /exams/{exam_pk}/assignment-rules/                              [Grading] req=json:AssignmentRuleRequest resp=201:AssignmentRuleResponse | Create rule (RF-8.1) 'can_assign_correctors' required
PUT    /exams/{exam_pk}/convocation/                                   [Exams] req=json:SetConvocationRequest resp=200:ConvocationResponse | Set convocation (RF-6.4) 'can_manage_members' required
GET    /exams/{exam_pk}/coverage/                                      [Grading] req= resp=200:CoverageResponse | Coverage check (RF-8.5) 'can_assign_correctors' required
GET    /exams/{exam_pk}/export/                                        [Exams] req= resp=200:string | Export grades (CSV or JSON)
GET    /exams/{exam_pk}/instances/                                     [Instances] req= resp=200:PaginatedInstanceResponseList | List instances (RF-7.4)
POST   /exams/{exam_pk}/instances/create/                              [Instances] req=json:UpdateInstanceRequest resp=201:InstanceResponse | Create a new exam instance manually
POST   /exams/{exam_pk}/models/                                        [Exams] req=json:CreateModelRequest resp=201:ModelDetail | Create model (RF-6.5) 'can_create_exams' required
POST   /exams/{exam_pk}/publish/                                       [Instances] req= resp=200:PublishResult | Bulk-publish all graded instances of an exam (RF-7.9) 'can_publish_gra
GET    /exams/{exam_pk}/review/                                        [Reviews] req= resp=200:ReviewResponse | Get review status
POST   /exams/{exam_pk}/review/                                        [Reviews] req=json:CreateReviewRequest resp=201:ReviewResponse | Create review window (RF-12.1) 'can_manage_reviews' required
GET    /instances/{instance_pk}/                                       [Instances] req= resp=200:InstanceResponse | Instance detail (RF-7.3) – response shape depends on user role and rev
PATCH  /instances/{instance_pk}/                                       [Instances] req=json:PatchedUpdateInstanceRequest resp=200:InstanceResponse | Update instance (RF-7.2)
DELETE /instances/{instance_pk}/                                       [Instances] req= resp=204 | Delete instance (RF-7.10)
GET    /instances/{instance_pk}/annotations/                           [Annotations] req= resp=200:array | List annotations (RF-10.4)
POST   /instances/{instance_pk}/annotations/                           [Annotations] req=form-data:CreateAnnotationRequest resp=201:AnnotationResponse | Create annotation (RF-10.1)
GET    /instances/{instance_pk}/download/                              [Instances] req= resp=200:string | Download composed instance PDF (RF-7.15) – with watermark and anti-dow
GET    /instances/{instance_pk}/pages/                                 [Pages] req= resp=200:array | List pages of instance
DELETE /instances/{instance_pk}/pages/{page_pk}/                       [Pages] req= resp=204 | Discard page ('can_resolve_issues' or assigned required)
PATCH  /instances/{instance_pk}/pages/{page_pk}/accept/                [Pages] req= resp=200:DetailResponse | Accept extra page('can_resolve_issues' or assigned required)
POST   /instances/{instance_pk}/pages/{page_pk}/move/                  [Pages] req=json:MovePageRequest resp=200:DetailResponse | Move page ('can_resolve_issues')
POST   /instances/{instance_pk}/pages/attach/                          [Pages] req=json:AttachPageRequest resp=200:DetailResponse | Attach orphan page
PATCH  /instances/{instance_pk}/pages/reorder/                         [Pages] req=json:PatchedReorderPagesRequest resp=200:DetailResponse | Reorder pages ('can_resolve_issues' or assigned required)
PUT    /instances/{instance_pk}/problems/{problem_pk}/grade/           [Grading] req=json:ManualGradeRequest resp=200:GradeResponse | Manual grade with optimistic concurrency (RF-11.1) 
PUT    /instances/{instance_pk}/problems/{problem_pk}/rubric/          [Grading] req=json:RubricGradeRequest resp=200:GradeResponse | Rubric grade with optimistic concurrency (RF-11.2)
GET    /instances/{instance_pk}/review-requests/                       [Reviews] req= resp=200:array | List review requests for instance ('can_manage_reviews': all, teacher:
POST   /instances/{instance_pk}/review-requests/                       [Reviews] req=json:SubmitReviewRequestRequest resp=201:array | Submit review requests (RF-12.4)
PATCH  /instances/{instance_pk}/transition/                            [Instances] req=json:PatchedTransitionRequest resp=200:InstanceResponse | Move an instance through its state machine (RF-7.5)
GET    /memberships/{membership_pk}/permissions/                       [Subjects] req= resp=200:EffectivePermissions | Get effective permissions (RF-5.5) Absence means false
PATCH  /memberships/{membership_pk}/permissions/                       [Subjects] req=json:PatchedUpdatePermissionsRequest resp=200:EffectivePermissions | Update permission overrides (RF-5.3) ('can_delegate_perms' required)
GET    /models/{model_pk}/                                             [Exams] req= resp=200:ModelDetail | Get model detail – list page profiles with zones 'can_create_exams' re
PUT    /models/{model_pk}/blank-pdf/                                   [Exams] req=form-data:BlankPDFUploadRequestRequest resp=200:BlankPDFUploadResponse | Upload blank PDF (RF-6.7) 'can_create_exams' required
GET    /models/{model_pk}/page-profiles/                               [Exams] req= resp=200:array | List page profiles 'can_create_exams' required
POST   /models/{model_pk}/page-profiles/                               [Exams] req=json:CreatePageProfileRequest resp=201:PageProfileResponse | Create page profile (RF-6.8) 'can_create_exams' required
POST   /models/{model_pk}/problems/                                    [Exams] req=json:CreateProblemRequest resp=201:ProblemResponse | Create problem (RF-6.9) 'can_create_rubric' required
POST   /models/{model_pk}/qr-pdf/                                      [Exams] req= resp=200:string | Generate instrumented PDF (RF-6.15) 'can_create_exams' required
GET    /my-exams/                                                      [Exams] req= resp=200:array | List my exams in the active course
GET    /my-subjects/                                                   [Subjects] req= resp=200:array | (MAIN ENDPOINT) List user subjects in the active course
GET    /my-tasks/                                                      [Grading] req= resp=200:MyTasksResponse | My grading tasks and pending reviews (RF-8.6)
GET    /notifications/                                                 [Notifications] req= resp=200:PaginatedNotificationResponseList | List notifications (RF-13.4)
GET    /notifications/count/                                           [Notifications] req= resp=200:UnreadCountResponse | Unread notification count
PATCH  /notifications/read/                                            [Notifications] req=json:PatchedMarkReadRequest resp=200:MarkReadResponse | Mark notifications as read (RF-13.3)
POST   /organizations/                                                 [Organizations] req=json:CreateOrganizationRequest resp=201:OrganizationResponse | Create organization with initial manager
GET    /orphan-pages/                                                  [Pages] req= resp=200:array | List orphan pages in the organization
POST   /orphan-pages/{page_pk}/attach/                                 [Pages] req=json:AttachPageRequest resp=200:DetailResponse | Attach an orphan page to an instance
POST   /page-profiles/{profile_pk}/zones/                              [Exams] req=json:CreateZoneRequest resp=201:ZoneResponse | Create zone (RF-6.8) 'can_create_exams' required
POST   /problems/{problem_pk}/rubric/                                  [Exams] req=json:SetRubricRequest resp=201:array | Set rubric (RF-6.11) 'can_create_rubric' required
GET    /profile/                                                       [Users] req= resp=200:ProfileResponse | View own profile (RF-2.10)
PATCH  /profile/                                                       [Users] req=json:PatchedUpdateProfileRequest resp=200:ProfileResponse | Update own email or notification preferences (RF-2.9, RF-2.11)
GET    /recognition/engines/                                           [Ingestion] req= resp=200:array | List registered OCR engines (RF-9.9)
POST   /recognition/ingest/                                            [Ingestion] req=form-data:ManualIngestRequestRequest resp=202:ManualIngestResponse | Manually ingest pages (PDF or image) (RF-9.2)
PATCH  /review-requests/{request_pk}/resolve/                          [Reviews] req=json:PatchedResolveRequestRequest resp=200:ReviewRequestResponse | Resolve review request (RF-12.7) required assigment rule or 'can_manag
GET    /search/                                                        [Organizations] req= resp=200:PaginatedCourseList | Hierarchical search (RF-14.3)
POST   /subjects/                                                      [Subjects] req=json:CreateSubjectRequest resp=201:SubjectResponse | Create subject
GET    /subjects/{id}/                                                 [Subjects] req= resp=200:SubjectDetail | Subject details (RF-4.9), extended details if teacher of above, reduce
PATCH  /subjects/{id}/                                                 [Subjects] req=json:PatchedUpdateSubjectRequest resp=200:SubjectResponse | Update subject (RF-4.3). Manager or coordinator.
DELETE /subjects/{id}/                                                 [Subjects] req= resp=204 | Delete subject (RF-4.4). Manager only.
GET    /subjects/{subject_pk}/exams/                                   [Exams] req= resp=200:array | List exams in a subject (RF-6.12)
POST   /subjects/{subject_pk}/exams/                                   [Exams] req=json:CreateExamRequest resp=201:ExamFull | Create exam (RF-6.1) 'can_create_exams' required
GET    /subjects/{subject_pk}/groups/                                  [Subjects] req= resp=200:PaginatedGroupResponseList | List groups in a subject ('can_manage_groups' required)
POST   /subjects/{subject_pk}/groups/                                  [Subjects] req=json:CreateGroupRequest resp=201:GroupResponse | Create group in a subject ('can_manage_groups' required)
PATCH  /subjects/{subject_pk}/groups/{group_pk}/                       [Subjects] req=json:PatchedUpdateGroupRequest resp=200:GroupResponse | Rename a group ('can_manage_groups' required)
DELETE /subjects/{subject_pk}/groups/{group_pk}/                       [Subjects] req= resp=204 | Delete a group ('can_manage_groups' required)
GET    /subjects/{subject_pk}/members/                                 [Subjects] req= resp=200:PaginatedMembershipResponseList | List subject members ('can_manage_members' required)
POST   /subjects/{subject_pk}/members/                                 [Subjects] req=json:AssignMemberRequest resp=201:MembershipResponse | Assign user to subject ('can_manage_members' required)
DELETE /subjects/{subject_pk}/members/{membership_pk}/                 [Subjects] req= resp=204 | Remove member from subject ('can_manage_members' required)
GET    /subjects/export/                                               [Subjects] req= resp=200:array | Export subjects
POST   /subjects/import/                                               [Subjects] req=form-data:SubjectFileUploadRequest resp=200:SubjectImportResult | Bulk import subjects from JSON or CSV
GET    /users/                                                         [Users] req= resp=200:PaginatedUserResponseList | List users with filters
POST   /users/                                                         [Users] req=json:CreateUserRequest resp=201:UserResponse | Create a new user
GET    /users/{id}/                                                    [Users] req= resp=200 | Retrieve a user
PATCH  /users/{id}/                                                    [Users] req=json:PatchedUpdateUserRequest resp=200:UserResponse | Update a user
POST   /users/{id}/reset-password/                                     [Users] req= resp=200 | Reset user password
GET    /users/export/                                                  [Users] req= resp=200:string | Export users to CSV or JSON
POST   /users/import/                                                  [Users] req=form-data:UserImportRequestRequest resp=200:UserImportResult | Bulk import users from CSV or JSON
DELETE /zones/{zone_pk}/                                               [Exams] req= resp=204 | Delete zone (RF-6.8) 'can_create_exams' required
GET    /health/                                                               [System] req= resp=200:HealthCheckResponse | Health check (RNF-5)
```

## Schemas (`*` = required, `ro` = read-only)
```
TokenPairResponse:
   *access_token: string ro
   *refresh_token: string ro
   *user: object? ro
UserResponse:
   *id: string(uuid) ro
   *email: string(email) ro
   *first_name: string ro
   *last_name: string ro
   *nia: string ro
   *is_active: boolean ro
   *is_staff: boolean ro
   *organization_id: string(uuid) ro
   *email_notifications_enabled: boolean ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
CreateUserRequest:
   *email: string(email)
   *first_name: string
   *last_name: string
    dni: string
    nia: string
    is_staff: boolean
PatchedUpdateUserRequest:
    first_name: string
    last_name: string
    email: string(email)
    nia: string
    dni: string
    is_staff: boolean
    is_active: boolean
PaginatedUserResponseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [UserResponse]
UserImportResult:
   *created: integer ro
   *reactivated: integer ro
   *updated: integer ro
   *total_processed: integer ro
   *total_errors: integer ro
   *errors: [object] ro
ProfileResponse:
   *id: string(uuid) ro
   *email: string(email) ro
   *first_name: string ro
   *last_name: string ro
   *nia: string ro
   *dni: string ro
   *organization_id: string(uuid) ro
   *email_notifications_enabled: boolean ro
PatchedUpdateProfileRequest:
    email: string(email)
    email_notifications_enabled: boolean
Course:
   *id: string(uuid) ro
   *label: string ro
   *start_date: string(date) ro
   *end_date: string(date) ro
   *is_active: boolean ro
   *subject_count: integer ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
CreateCourseRequest:
   *label: string
    start_date: string(date)?
    end_date: string(date)?
PatchedUpdateCourseRequest:
    label: string
    start_date: string(date)?
    end_date: string(date)?
OrgConfig:
    default_ocr_engine: string
    recognition_confidence_threshold: number(double)
    assembly_timeout_seconds: integer
    max_audio_duration_minutes: integer
    max_page_size_mb: integer
    auto_delete_frequency_days: integer
    delete_notice_days: integer
    default_language: string
    temp_url_expiration_minutes: integer
    role_permission_defaults: ?
    grade_export_columns: ?
PatchedOrgConfigRequest:
    default_ocr_engine: string
    recognition_confidence_threshold: number(double)
    assembly_timeout_seconds: integer
    max_audio_duration_minutes: integer
    max_page_size_mb: integer
    auto_delete_frequency_days: integer
    delete_notice_days: integer
    default_language: string
    temp_url_expiration_minutes: integer
    role_permission_defaults: ?
    grade_export_columns: ?
NotificationResponse:
   *id: string(uuid) ro
   *notification_type: string ro
   *title: string ro
   *message: string ro
   *status: string ro
   *metadata: ? ro
   *created_at: string(date-time) ro
PaginatedNotificationResponseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [NotificationResponse]
UnreadCountResponse:
   *unread_count: integer ro
PatchedMarkReadRequest:
    notification_ids: [string(uuid)]
MarkReadResponse:
   *marked_read: integer ro
MySubject:
   *id: string(uuid) ro
   *name: string ro
   *code: string ro
   *semester: string ro
   *role: string ro
   *group_label: string ro
   *coordinator_email: string ro
SubjectDetail:
   *id: string(uuid) ro
   *name: string ro
   *code: string ro
   *semester: string ro
   *course_id: string(uuid) ro
   *coordinator_id: string(uuid) ro
   *coordinator_email: string ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
   *groups: [object] ro
   *member_counts: object ro
SubjectResponse:
   *id: string(uuid) ro
   *name: string ro
   *code: string ro
   *semester: string ro
   *course_id: string(uuid) ro
   *coordinator_id: string(uuid) ro
   *coordinator_email: string ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
CreateSubjectRequest:
   *name: string
   *code: string
    semester: string
   *coordinator_id: string(uuid)
PatchedUpdateSubjectRequest:
    name: string
    code: string
    semester: string
    coordinator_id: string(uuid)
SubjectImportResult:
   *created: integer ro
   *total_errors: integer ro
   *errors: [object] ro
MembershipResponse:
   *id: string(uuid) ro
   *user_id: string(uuid) ro
   *user_email: string ro
   *user_name: string ro
   *subject_id: string(uuid) ro
   *role: string ro
   *group_id: string(uuid)? ro
   *group_label: string ro
   *permission_overrides: ? ro
   *is_active: boolean ro
AssignMemberRequest:
   *user_id: string(uuid)
   *role: RoleEnum
    group_id: string(uuid)?
GroupResponse:
   *id: string(uuid) ro
   *label: string ro
   *subject_id: string(uuid) ro
   *member_count: integer ro
CreateGroupRequest:
   *label: string
PatchedUpdateGroupRequest:
    label: string
EffectivePermissions:
   *permissions: object ro
   *role: string ro
   *has_overrides: boolean ro
   *is_staff_bypass: boolean ro
PatchedUpdatePermissionsRequest:
    permissions: object
AuditLog:
   *id: string(uuid) ro
   *event_type: string ro
   *actor: string(uuid)? ro
   *actor_email: string? ro
   *ip_address: string? ro
   *timestamp: string(date-time) ro
   *entity_type: string ro
   *entity_id: string ro
   *payload: ? ro
PaginatedAuditLogList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [AuditLog]
OrganizationResponse:
   *id: string(uuid) ro
   *name: string ro
   *subdomain: string ro
   *plan: string ro
   *auth_mode: string ro
   *is_active: boolean ro
   *created_at: string(date-time) ro
ExamFull:
   *id: string(uuid) ro
   *name: string ro
   *date: string(date-time) ro
   *subject_id: string(uuid) ro
   *subject_name: string ro
   *subject_code: string ro
   *models_problems: [object] ro
   *convocation: [ConvocationStudent] ro
   *student_permissions: ? ro
InstanceResponse:
   *id: string(uuid) ro
   *exam_id: string(uuid) ro
   *student_id: string(uuid)? ro
   *student_email: string ro
   *model_id: string(uuid)? ro
   *model_label: string ro
   *status: string ro
   *has_issues: boolean ro
   *issue_types: ? ro
   *total_score: string(decimal)? ro
   *expected_pages: integer ro
   *page_ids: [string(uuid)] ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
PatchedTransitionRequest:
    target_status: TargetStatusEnum
TargetStatusEnum: enum ['ASSEMBLING', 'RECEIVED', 'QUEUED', 'PENDING_GRADING', 'GRADED', 'PUBLISHED', 'IN_REVIEW', 'PENDING_REVIEW', 'FINALIZED', 'ARCHIVED']
AnnotationResponse:
   *id: string(uuid) ro
   *instance_id: string(uuid) ro
   *annotation_type: string ro
   *storage_ref: string ro
   *download_url: string? ro
   *page_number: integer ro
   *x: number(double) ro
   *y: number(double) ro
   *problem_id: string(uuid)? ro
   *author_id: string(uuid) ro
   *author_email: string ro
   *is_grade_annotation: boolean ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
CreateAnnotationRequest:
   *annotation_type: AnnotationTypeEnum
    payload: string
    page_number: integer
    x: number(double)
    y: number(double)
    problem_id: string(uuid)?
    is_grade_annotation: boolean
ManualGradeRequest:
   *score: string(decimal)
    old_score: string(decimal)?
RubricGradeRequest:
   *criterion_ids: [string(uuid)]
    old_score: string(decimal)?
GradeResponse:
   *problem_id: string(uuid) ro
   *problem_name: string ro
   *score: string(decimal) ro
   *grader_email: string ro
   *rubric_selections: ? ro
MyTasksResponse:
   *grading_tasks: [CorrectorTask] ro
   *pending_reviews: [PendingReview] ro
CorrectorTask:
   *instance_id: string(uuid) ro
   *exam_name: string ro
   *student_email: string? ro
   *ungraded_problems: [string(uuid)] ro
   *problems_sent: [string(uuid)] ro
   *total_problems: integer ro
PendingReview:
   *review_request_id: string(uuid) ro
   *instance_id: string(uuid) ro
   *exam_name: string ro
   *student_email: string? ro
   *problem_name: string ro
   *problem_id: string(uuid) ro
   *student_message: string ro
   *resolver_message: string ro
   *created_at: string(date-time) ro
ProblemResponse:
   *id: string(uuid) ro
   *name: string ro
   *max_score: string(decimal) ro
   *order: integer ro
   *exam_model_id: string(uuid) ro
   *zone_ids: [string(uuid)] ro
   *rubric_criteria: [RubricCriterionResponse] ro
RubricCriterionResponse:
   *id: string(uuid) ro
   *description: string ro
   *score: string ro
   *order: integer ro
ReviewResponse:
   *id: string(uuid) ro
   *exam_id: string(uuid) ro
   *start_date: string(date-time) ro
   *end_date: string(date-time) ro
   *status: string ro
   *request_count: integer ro
   *created_at: string(date-time) ro
CreateReviewRequest:
   *start_date: string(date-time)
   *end_date: string(date-time)
    notify_students: boolean
ReviewRequestResponse:
   *id: string(uuid) ro
   *instance_id: string(uuid) ro
   *problem_id: string(uuid) ro
   *problem_name: string ro
   *student_message: string ro
   *resolved: boolean ro
   *resolved_at: string(date-time)? ro
   *resolver_message: string ro
   *created_at: string(date-time) ro
SubmitReviewRequestRequest:
   *problems: [object]
PatchedResolveRequestRequest:
    resolver_message: string
PublishResult:
   *published: integer ro
   *skipped: integer ro
   *total: integer ro
   *errors: [PublishError] ro
CoverageResponse:
   *complete: boolean ro
   *total_problems: integer ro
   *covered_problems: integer ro
   *uncovered_problems: [UncoveredProblem] ro
   *total_instances: integer ro
   *rules_count: integer ro
ValidationErrorResponse:
   *error_code: ValidationErrorResponseErrorCodeEnum
   *errors: object
HealthCheckResponse:
   *status: StatusEnum
   *components: object
```
