# API inventory (generated)

Source: canonical contract of the local backend `SCDEE-backend`, branch `fix/integracion-real` @ 5e4f297 (2026-10-23), file `docs/files/spectacular/SCDEE API.yaml` (SHA-256 LF 4733013068511572d98bfcd02749e3bcf609ad3fdad8f4b9624c270effd99a70). Previous source: `anxoCRuam/SCDEE` `backend` @ a8eb9f43.
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
GET    /exams/{exam_pk}/                                               [Exams] req= resp=200:ExamRead | Exam detail (RF-6.13)
PATCH  /exams/{exam_pk}/                                               [Exams] req=json:PatchedUpdateExamRequest resp=200:ExamFull | Update exam (RF-6.2) 'can_create_exams' required
DELETE /exams/{exam_pk}/                                               [Exams] req= resp=204 | Delete exam (RF-6.3) 'can_create_exams' required
GET    /exams/{exam_pk}/assignment-rules/                              [Grading] req= resp=200:array | List rules 'can_assign_correctors' required
POST   /exams/{exam_pk}/assignment-rules/                              [Grading] req=json:AssignmentRuleRequest resp=201:AssignmentRuleResponse | Create rule (RF-8.1) 'can_assign_correctors' required
PUT    /exams/{exam_pk}/convocation/                                   [Exams] req=json:SetConvocationRequest resp=200:ConvocationResponse | Set convocation (RF-6.4) 'can_manage_members' required
GET    /exams/{exam_pk}/coverage/                                      [Grading] req= resp=200:CoverageResponse | Coverage check (RF-8.5) 'can_assign_correctors' required
GET    /exams/{exam_pk}/export/                                        [Exams] req= resp=200:string | Export grades (CSV or JSON)
GET    /exams/{exam_pk}/instances/                                     [Instances] req= resp=200:InstanceList | List instances (RF-7.4)
POST   /exams/{exam_pk}/instances/create/                              [Instances] req=json:CreateInstanceRequest resp=201:InstanceResponse | Create a new exam instance manually
POST   /exams/{exam_pk}/models/                                        [Exams] req=json:CreateModelRequest resp=201:ModelDetail | Create model (RF-6.5) 'can_create_exams' required
POST   /exams/{exam_pk}/publish/                                       [Instances] req= resp=200:PublishResult | Bulk-publish all graded instances of an exam (RF-7.9) 'can_publish_gra
GET    /exams/{exam_pk}/review/                                        [Reviews] req= resp=200:ReviewRead | Get review status
POST   /exams/{exam_pk}/review/                                        [Reviews] req=json:CreateReviewRequest resp=201:ReviewResponse | Create review window (RF-12.1) 'can_manage_reviews' required
GET    /instances/{instance_pk}/                                       [Instances] req= resp=200:InstanceDetail | Instance detail (RF-7.3) – response shape depends on user role and rev
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
GET    /memberships/{membership_pk}/permissions/                       [Subjects] req= resp=200:EffectivePermissions | Get own or managed membership permissions (RF-5.5); absence means fals
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
POST   /orphan-pages/{page_pk}/attach/                                 [Pages] req=json:AttachOrphanPageRequest resp=200:DetailResponse | Attach an orphan page to an instance
POST   /page-profiles/{profile_pk}/zones/                              [Exams] req=json:CreateZoneRequest resp=201:array | Create zone (RF-6.8) 'can_create_exams' required
GET    /pages/{page_pk}/image/                                         [Pages] req= resp=200:string | Inspect a scan with incident-resolution authorization
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
AnnotationTypeEnum: enum ['TEXT', 'STYLUS', 'AUDIO']
AssignMemberRequest:
   *user_id: string(uuid)
   *role: RoleEnum
    group_id: string(uuid)?
AssignmentRuleRequest:
    groups: [string(uuid)]
    models_filter: [string(uuid)]
   *problems: [string(uuid)]
   *correctors: [string(uuid)]
AssignmentRuleResponse:
   *id: string(uuid) ro
   *exam_id: string(uuid) ro
   *groups: ? ro
   *models_filter: ? ro
   *problems: ? ro
   *correctors: ? ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
AttachOrphanPageRequest:
   *instance_id: string(uuid)
AttachPageRequest:
   *page_id: string(uuid)
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
BlankPDFInputError:
BlankPDFUploadRequestRequest:
   *file: string(binary)
BlankPDFUploadResponse:
   *blank_pdf_ref: string ro
   *pages: integer ro
   *page_dimensions: [PageDimension] ro
   *size_bytes: integer ro
ComponentStatus:
   *status: StatusEnum
    error: string
    workers: integer
    note: string
ConvocationResponse:
   *total: integer ro
   *valid: integer ro
   *invalid: [?] ro
ConvocationStudent:
   *id: string(uuid) ro
   *email: string(email) ro
   *first_name: string ro
   *last_name: string ro
CorrectorTask:
   *instance_id: string(uuid) ro
   *exam_name: string ro
   *student_email: string? ro
   *ungraded_problems: [string(uuid)] ro
   *problems_sent: [string(uuid)] ro
   *total_problems: integer ro
Course:
   *id: string(uuid) ro
   *label: string ro
   *start_date: string(date)? ro
   *end_date: string(date)? ro
   *is_active: boolean ro
   *subject_count: integer ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
CoverageResponse:
   *complete: boolean ro
   *total_problems: integer ro
   *covered_problems: integer ro
   *uncovered_problems: [UncoveredProblem] ro
   *total_instances: integer ro
   *rules_count: integer ro
CreateAnnotationRequest:
   *annotation_type: AnnotationTypeEnum
    payload: string
    page_number: integer
    x: number(double)
    y: number(double)
    problem_id: string(uuid)?
    is_grade_annotation: boolean
CreateCourseRequest:
   *label: string
    start_date: string(date)?
    end_date: string(date)?
CreateExamRequest:
   *name: string
    date: string(date-time)
CreateGroupRequest:
   *label: string
CreateInstanceRequest:
    student_id: string(uuid)
    model_id: string(uuid)
    expected_pages: integer
CreateModelRequest:
   *label: string
    copy_from_id: string(uuid)?
CreateOrganizationRequest:
   *name: string
   *subdomain: string
    plan: PlanEnum
   *initial_manager: InitialManagerRequest
CreatePageProfileRequest:
   *page_number: integer
CreateProblemRequest:
   *name: string
   *max_score: string(decimal)
    order: integer
    zone_ids: [string(uuid)]
CreateReviewRequest:
   *start_date: string(date-time)
   *end_date: string(date-time)
    notify_students: boolean
CreateSubjectRequest:
   *name: string
   *code: string
    semester: string
   *coordinator_id: string(uuid)
CreateUserRequest:
   *email: string(email)
   *first_name: string
   *last_name: string
    dni: string
    nia: string
    is_staff: boolean
CreateZoneRequest:
   *zone_type: ZoneTypeEnum
   *attribute: string
   *x: number(double)
   *y: number(double)
   *width: number(double)
   *height: number(double)
    page_numbers: [integer]
DetailResponse:
   *detail: string ro
EffectivePermissions:
   *permissions: object ro
   *role: string ro
   *has_overrides: boolean ro
   *is_staff_bypass: boolean ro
ErrorResponse400DUPLICATESTUDENTEXPECTEDPAGESREQUIREDMODELNOTFOUNDNOTFOUNDSTUDENTNOT_ErrorCodeEnum: enum ['DUPLICATE_STUDENT', 'EXPECTED_PAGES_REQUIRED', 'MODEL_NOT_FOUND', 'NOT_FOUND', 'STUDENT_NOT_FOUND']
ErrorResponse400INVALIDCOORDINATESINVALIDDIMENSIONSINVALIDPAGENUMBERINVALIDZONETYPEZONErrorCodeEnum: enum ['INVALID_COORDINATES', 'INVALID_DIMENSIONS', 'INVALID_PAGE_NUMBER', 'INVALID_ZONE_TYPE', 'ZONE_EXCEEDS_PAGE_HEIGHT', 'ZONE_EXCEEDS_PAGE_WIDTH']
ErrorResponse400INVALIDPDFNOFILEPROVIDEDErrorCodeEnum: enum ['INVALID_PDF', 'NO_FILE_PROVIDED']
ErrorResponse400NOFILEPROVIDEDErrorCodeEnum: enum ['NO_FILE_PROVIDED']
ErrorResponse400_DUPLICATE_STUDENT_EXPECTED_PAGES_REQUIRED_MODEL_NOT_FOUND_NOT_FOUND_STUDENT_NOT_:
   *error_code: ErrorResponse400DUPLICATESTUDENTEXPECTEDPAGESREQUIREDMODELNOTFOUNDNOTFOUNDSTUDENTNOT_ErrorCodeEnum
ErrorResponse400_INVALID_COORDINATES_INVALID_DIMENSIONS_INVALID_PAGE_NUMBER_INVALID_ZONE_TYPE_ZON:
   *error_code: ErrorResponse400INVALIDCOORDINATESINVALIDDIMENSIONSINVALIDPAGENUMBERINVALIDZONETYPEZONErrorCodeEnum
ErrorResponse400_INVALID_PDF_NO_FILE_PROVIDED:
   *error_code: ErrorResponse400INVALIDPDFNOFILEPROVIDEDErrorCodeEnum
ErrorResponse400_NO_FILE_PROVIDED:
   *error_code: ErrorResponse400NOFILEPROVIDEDErrorCodeEnum
ErrorResponse401AUTHENTICATIONREQUIREDErrorCodeEnum: enum ['AUTHENTICATION_REQUIRED']
ErrorResponse401INVALIDCREDENTIALSORGINACTIVEUSERINACTIVEErrorCodeEnum: enum ['INVALID_CREDENTIALS', 'ORG_INACTIVE', 'USER_INACTIVE']
ErrorResponse401INVALIDTOKENINVALIDTOKENTYPETOKENEXPIREDTOKENREVOKEDErrorCodeEnum: enum ['INVALID_TOKEN', 'INVALID_TOKEN_TYPE', 'TOKEN_EXPIRED', 'TOKEN_REVOKED']
ErrorResponse401_AUTHENTICATION_REQUIRED:
   *error_code: ErrorResponse401AUTHENTICATIONREQUIREDErrorCodeEnum
ErrorResponse401_INVALID_CREDENTIALS_ORG_INACTIVE_USER_INACTIVE:
   *error_code: ErrorResponse401INVALIDCREDENTIALSORGINACTIVEUSERINACTIVEErrorCodeEnum
ErrorResponse401_INVALID_TOKEN_INVALID_TOKEN_TYPE_TOKEN_EXPIRED_TOKEN_REVOKED:
   *error_code: ErrorResponse401INVALIDTOKENINVALIDTOKENTYPETOKENEXPIREDTOKENREVOKEDErrorCodeEnum
ErrorResponse403PERMISSIONDENIEDErrorCodeEnum: enum ['PERMISSION_DENIED']
ErrorResponse403_PERMISSION_DENIED:
   *error_code: ErrorResponse403PERMISSIONDENIEDErrorCodeEnum
ErrorResponse404NOTFOUNDPAGENOTORPHANErrorCodeEnum: enum ['NOT_FOUND', 'PAGE_NOT_ORPHAN']
ErrorResponse404NOTFOUNDTARGETNOTFOUNDErrorCodeEnum: enum ['NOT_FOUND', 'TARGET_NOT_FOUND']
ErrorResponse404PAGENOTORPHANTARGETNOTFOUNDErrorCodeEnum: enum ['PAGE_NOT_ORPHAN', 'TARGET_NOT_FOUND']
ErrorResponse404_NOT_FOUND_PAGE_NOT_ORPHAN:
   *error_code: ErrorResponse404NOTFOUNDPAGENOTORPHANErrorCodeEnum
ErrorResponse404_NOT_FOUND_TARGET_NOT_FOUND:
   *error_code: ErrorResponse404NOTFOUNDTARGETNOTFOUNDErrorCodeEnum
ErrorResponse404_PAGE_NOT_ORPHAN_TARGET_NOT_FOUND:
   *error_code: ErrorResponse404PAGENOTORPHANTARGETNOTFOUNDErrorCodeEnum
ErrorResponse409COURSEARCHIVEDErrorCodeEnum: enum ['COURSE_ARCHIVED']
ErrorResponse409COURSEARCHIVEDHASINSTANCESErrorCodeEnum: enum ['COURSE_ARCHIVED', 'HAS_INSTANCES']
ErrorResponse409COURSEARCHIVEDMODELLABELEXISTSSOURCEMODELNOTFOUNDErrorCodeEnum: enum ['COURSE_ARCHIVED', 'MODEL_LABEL_EXISTS', 'SOURCE_MODEL_NOT_FOUND']
ErrorResponse409DIFFERENTEXAMDIFFERENTORGANIZATIONPAGENOTORPHANErrorCodeEnum: enum ['DIFFERENT_EXAM', 'DIFFERENT_ORGANIZATION', 'PAGE_NOT_ORPHAN']
ErrorResponse409DIFFERENTEXAMErrorCodeEnum: enum ['DIFFERENT_EXAM']
ErrorResponse409DUPLICATESTUDENTMODELNOTFOUNDUSERNOTFOUNDErrorCodeEnum: enum ['DUPLICATE_STUDENT', 'MODEL_NOT_FOUND', 'USER_NOT_FOUND']
ErrorResponse409EMAILALREADYEXISTSErrorCodeEnum: enum ['EMAIL_ALREADY_EXISTS']
ErrorResponse409HASUNRESOLVEDISSUESINVALIDTRANSITIONErrorCodeEnum: enum ['HAS_UNRESOLVED_ISSUES', 'INVALID_TRANSITION']
ErrorResponse409INVALIDCRITERIAVERSIONCONFLICTErrorCodeEnum: enum ['INVALID_CRITERIA', 'VERSION_CONFLICT']
ErrorResponse409INVALIDPAGENUMBERMISSINGPAGEDIMENSIONSNOBLANKPDFPAGEPROFILEEXISTSErrorCodeEnum: enum ['INVALID_PAGE_NUMBER', 'MISSING_PAGE_DIMENSIONS', 'NO_BLANK_PDF', 'PAGE_PROFILE_EXISTS']
ErrorResponse409SCOREEXCEEDSMAXVERSIONCONFLICTErrorCodeEnum: enum ['SCORE_EXCEEDS_MAX', 'VERSION_CONFLICT']
ErrorResponse409_COURSE_ARCHIVED:
   *error_code: ErrorResponse409COURSEARCHIVEDErrorCodeEnum
ErrorResponse409_COURSE_ARCHIVED_HAS_INSTANCES:
   *error_code: ErrorResponse409COURSEARCHIVEDHASINSTANCESErrorCodeEnum
ErrorResponse409_COURSE_ARCHIVED_MODEL_LABEL_EXISTS_SOURCE_MODEL_NOT_FOUND:
   *error_code: ErrorResponse409COURSEARCHIVEDMODELLABELEXISTSSOURCEMODELNOTFOUNDErrorCodeEnum
ErrorResponse409_DIFFERENT_EXAM:
   *error_code: ErrorResponse409DIFFERENTEXAMErrorCodeEnum
ErrorResponse409_DIFFERENT_EXAM_DIFFERENT_ORGANIZATION_PAGE_NOT_ORPHAN:
   *error_code: ErrorResponse409DIFFERENTEXAMDIFFERENTORGANIZATIONPAGENOTORPHANErrorCodeEnum
ErrorResponse409_DUPLICATE_STUDENT_MODEL_NOT_FOUND_USER_NOT_FOUND:
   *error_code: ErrorResponse409DUPLICATESTUDENTMODELNOTFOUNDUSERNOTFOUNDErrorCodeEnum
ErrorResponse409_EMAIL_ALREADY_EXISTS:
   *error_code: ErrorResponse409EMAILALREADYEXISTSErrorCodeEnum
ErrorResponse409_HAS_UNRESOLVED_ISSUES_INVALID_TRANSITION:
   *error_code: ErrorResponse409HASUNRESOLVEDISSUESINVALIDTRANSITIONErrorCodeEnum
ErrorResponse409_INVALID_CRITERIA_VERSION_CONFLICT:
   *error_code: ErrorResponse409INVALIDCRITERIAVERSIONCONFLICTErrorCodeEnum
ErrorResponse409_INVALID_PAGE_NUMBER_MISSING_PAGE_DIMENSIONS_NO_BLANK_PDF_PAGE_PROFILE_EXISTS:
   *error_code: ErrorResponse409INVALIDPAGENUMBERMISSINGPAGEDIMENSIONSNOBLANKPDFPAGEPROFILEEXISTSErrorCodeEnum
ErrorResponse409_SCORE_EXCEEDS_MAX_VERSION_CONFLICT:
   *error_code: ErrorResponse409SCOREEXCEEDSMAXVERSIONCONFLICTErrorCodeEnum
ErrorResponse429RATELIMITEXCEEDEDErrorCodeEnum: enum ['RATE_LIMIT_EXCEEDED']
ErrorResponse429_RATE_LIMIT_EXCEEDED:
   *error_code: ErrorResponse429RATELIMITEXCEEDEDErrorCodeEnum
ExamBasic:
   *id: string(uuid) ro
   *name: string ro
   *date: string(date-time)? ro
   *subject_id: string(uuid) ro
   *subject_name: string ro
   *subject_code: string ro
ExamFull:
   *id: string(uuid) ro
   *name: string ro
   *date: string(date-time)? ro
   *subject_id: string(uuid) ro
   *subject_name: string ro
   *subject_code: string ro
   *models_problems: [ExamModelProblems] ro
   *convocation: [ConvocationStudent] ro
   *student_permissions: ? ro
ExamModelProblems:
   *model_id: string(uuid) ro
   *label: string ro
   *problems: [ProblemResponse] ro
ExamRead:
ExamTeacher:
   *id: string(uuid) ro
   *name: string ro
   *date: string(date-time)? ro
   *subject_id: string(uuid) ro
   *subject_name: string ro
   *subject_code: string ro
   *models_problems: [ExamModelProblems] ro
   *convocation: [ConvocationStudent] ro
GradeResponse:
   *problem_id: string(uuid) ro
   *problem_name: string ro
   *score: string(decimal) ro
   *grader_email: string ro
   *rubric_selections: ? ro
GroupResponse:
   *id: string(uuid) ro
   *label: string ro
   *subject_id: string(uuid) ro
   *member_count: integer ro
HealthCheckResponse:
   *status: StatusEnum
   *components: object
InitialManagerRequest:
   *email: string(email)
   *first_name: string
   *last_name: string
    dni: string
    nia: string
InstanceDetail:
InstanceInputError:
InstanceList:
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
   *grades: [GradeResponse]
LoginRequestRequest:
   *email: string(email)
   *password: string
LogoutRequestRequest:
   *refresh_token: string
ManualGradeRequest:
   *score: string(decimal)
    old_score: string(decimal)?
ManualIngestRequestRequest:
   *file: string(binary)
ManualIngestResponse:
   *task_id: string ro
   *filename: string ro
   *total_pages: integer ro
   *pages: [object] ro
   *status: string ro
MarkReadResponse:
   *marked_read: integer ro
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
ModelDetail:
   *id: string(uuid) ro
   *label: string ro
   *exam_id: string(uuid) ro
   *blank_pdf_ref: string ro
   *blank_pdf_pages: integer ro
   *blank_pdf_size: integer ro
   *page_dimensions: [PageDimension] ro
   *created_at: string(date-time) ro
   *updated_at: string(date-time) ro
   *page_profiles: [PageProfileResponse] ro
MovePageRequest:
   *target_instance_id: string(uuid)
MySubject:
   *id: string(uuid) ro
   *name: string ro
   *code: string ro
   *semester: string ro
   *role: string ro
   *group_label: string ro
   *coordinator_email: string ro
MyTasksResponse:
   *grading_tasks: [CorrectorTask] ro
   *pending_reviews: [PendingReview] ro
NotificationResponse:
   *id: string(uuid) ro
   *notification_type: string ro
   *title: string ro
   *message: string ro
   *status: string ro
   *metadata: ? ro
   *created_at: string(date-time) ro
OCREngine:
   *engine_id: string ro
   *type: string ro
OCRGradeResponse:
   *recognized_value: string? ro
   *confidence: number(double) ro
   *auto_applied: boolean ro
   *raw_value: string ro
OCRStylusResponse:
   *recognized_text: string? ro
   *confidence: number(double) ro
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
OrganizationResponse:
   *id: string(uuid) ro
   *name: string ro
   *subdomain: string ro
   *plan: string ro
   *auth_mode: string ro
   *is_active: boolean ro
   *created_at: string(date-time) ro
PageDimension:
   *page: integer ro
   *width: number(double) ro
   *height: number(double) ro
PageProfileResponse:
   *id: string(uuid) ro
   *page_number: integer ro
   *page_width: number(double) ro
   *page_height: number(double) ro
   *zones: [ZoneResponse] ro
PageResponse:
   *id: string(uuid) ro
   *instance_id: string(uuid)? ro
   *page_number: integer ro
   *storage_ref: string ro
   *status: string ro
   *issue_type: string ro
   *recognized_at: string(date-time)? ro
   *created_at: string(date-time) ro
   *image_url: string? ro
PaginatedAuditLogList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [AuditLog]
PaginatedCourseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [Course]
PaginatedGroupResponseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [GroupResponse]
PaginatedMembershipResponseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [MembershipResponse]
PaginatedNotificationResponseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [NotificationResponse]
PaginatedUserResponseList:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
    next: string(uri)?
    previous: string(uri)?
   *results: [UserResponse]
PatchedMarkReadRequest:
    notification_ids: [string(uuid)]
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
PatchedReorderPagesRequest:
    page_ids: [string(uuid)]
PatchedResolveRequestRequest:
    resolver_message: string
PatchedTransitionRequest:
    target_status: TargetStatusEnum
PatchedUpdateCourseRequest:
    label: string
    start_date: string(date)?
    end_date: string(date)?
PatchedUpdateExamRequest:
    name: string
    date: string(date-time)
    student_permissions: object
PatchedUpdateGroupRequest:
    label: string
PatchedUpdateInstanceRequest:
    student_id: string(uuid)
    model_id: string(uuid)
PatchedUpdatePermissionsRequest:
    permissions: object
PatchedUpdateProfileRequest:
    email: string(email)
    email_notifications_enabled: boolean
PatchedUpdateSubjectRequest:
    name: string
    code: string
    semester: string
    coordinator_id: string(uuid)
PatchedUpdateUserRequest:
    first_name: string
    last_name: string
    email: string(email)
    nia: string
    dni: string
    is_staff: boolean
    is_active: boolean
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
PlanEnum: enum ['FREE', 'PREMIUM']
ProblemResponse:
   *id: string(uuid) ro
   *name: string ro
   *max_score: string(decimal) ro
   *order: integer ro
   *exam_model_id: string(uuid) ro
   *zone_ids: [string(uuid)] ro
   *rubric_criteria: [RubricCriterionResponse] ro
ProfileResponse:
   *id: string(uuid) ro
   *email: string(email) ro
   *first_name: string ro
   *last_name: string ro
   *nia: string ro
   *dni: string ro
   *organization_id: string(uuid) ro
   *email_notifications_enabled: boolean ro
PublishError:
   *instance_id: string(uuid) ro
   *reason: string ro
PublishResult:
   *published: integer ro
   *skipped: integer ro
   *total: integer ro
   *errors: [PublishError] ro
RefreshRequestRequest:
   *refresh_token: string
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
ReviewResponse:
   *id: string(uuid) ro
   *exam_id: string(uuid) ro
   *start_date: string(date-time) ro
   *end_date: string(date-time) ro
   *status: string ro
   *created_at: string(date-time) ro
   *request_count: integer ro
RoleEnum: enum ['TEACHER', 'STUDENT']
RubricCriterionInputRequest:
   *description: string
   *score: string(decimal)
RubricCriterionResponse:
   *id: string(uuid) ro
   *description: string ro
   *score: string ro
   *order: integer ro
RubricGradeRequest:
   *criterion_ids: [string(uuid)]
    old_score: string(decimal)?
SetConvocationRequest:
   *student_ids: [string(uuid)]
SetRubricRequest:
   *criteria: [RubricCriterionInputRequest]
StaffInstancePage:
   *count: integer
   *page: integer
   *page_size: integer
   *total_pages: integer
   *next: string(uri)?
   *previous: string(uri)?
   *results: [InstanceResponse]
StatusEnum: enum ['healthy', 'unhealthy']
StudentGrade:
   *problem_id: string(uuid) ro
   *problem_name: string ro
   *score: string(decimal) ro
   *rubric_selections: [string(uuid)] ro
StudentInstance:
   *id: string(uuid) ro
   *exam_name: string ro
   *subject_name: string ro
   *status: string ro
   *total_score: string(decimal)? ro
    pages: [PageResponse]
   *can_download: boolean ro
    rubric: [StudentRubric]
    grades: [StudentGrade]
StudentRubric:
   *problem_id: string(uuid) ro
   *problem_name: string ro
   *max_score: string(decimal) ro
   *criteria: [StudentRubricCriterion] ro
StudentRubricCriterion:
   *description: string ro
   *score: string(decimal) ro
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
SubjectFileUploadRequest:
   *file: string(binary)
SubjectImportExportItem:
   *name: string
   *code: string
    semester: string
   *coordinator_email: string(email)
    groups: [string]
    teachers: [string(email)]
    students: [object]
SubjectImportResult:
   *created: integer ro
   *total_errors: integer ro
   *errors: [object] ro
SubjectRawDataRequest:
   *data: [object]
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
SubmitReviewRequestRequest:
   *problems: [object]
TargetStatusEnum: enum ['ASSEMBLING', 'RECEIVED', 'QUEUED', 'PENDING_GRADING', 'GRADED', 'PUBLISHED', 'IN_REVIEW', 'PENDING_REVIEW', 'FINALIZED', 'ARCHIVED']
TokenPairResponse:
   *access_token: string ro
   *refresh_token: string ro
   *user: object? ro
UncoveredProblem:
   *problem_id: string(uuid) ro
   *problem_name: string ro
   *model: string ro
UnreadCountResponse:
   *unread_count: integer ro
UpdateAnnotationRequest:
    payload: string
    page_number: integer
    x: number(double)
    y: number(double)
    problem_id: string(uuid)?
UserImportRequestRequest:
   *file: string(binary)
UserImportResult:
   *created: integer ro
   *reactivated: integer ro
   *updated: integer ro
   *total_processed: integer ro
   *total_errors: integer ro
   *errors: [object] ro
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
ValidationErrorResponse:
   *error_code: ValidationErrorResponseErrorCodeEnum
   *errors: object
ValidationErrorResponseErrorCodeEnum: enum ['VALIDATION_ERROR']
ZoneInputError:
ZoneResponse:
   *id: string(uuid) ro
   *zone_type: string ro
   *attribute: string ro
   *x: number(double) ro
   *y: number(double) ro
   *width: number(double) ro
   *height: number(double) ro
   *page_profile_id: string(uuid) ro
ZoneTypeEnum: enum ['OCR_TEXT', 'OCR_NUMBER', 'QR', 'CHECKBOX']
ReviewRead: anyOf(ReviewResponse|ReviewStatusResponse) — request_count only with effective can_manage_reviews
ReviewStatusResponse:
   *id: string(uuid) ro
   *exam_id: string(uuid) ro
   *start_date: string(date-time) ro
   *end_date: string(date-time) ro
   *status: string ro
   *created_at: string(date-time) ro
```
