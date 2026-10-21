# حفيظ | Hafez — توصية الأدوات (المرحلة 2)

> التاريخ: 2026-10-21 · لم يُثبَّت أي شيء ولم يُنشأ أي ملف في Figma. كل ما يلي بانتظار موافقتك.

## 1. نتيجة التحقق من Figma (فعلية وليست افتراضًا)

| الفحص | النتيجة |
|---|---|
| موصل Figma MCP الرسمي (البعيد) | **متصل** في هذه الجلسة، 42 أداة، ومصادقة OAuth عبر موصلات claude.ai (لا مفاتيح API في الملفات) |
| الحساب (`whoami`) | الفريق «بندر الطلحي's team» · الخطة **Starter** · المقعد **View** · الدور admin |
| Skills الرسمية | متاحة مباشرة من خادم MCP (`figma-use`, `figma-generate-library`, `figma-generate-design`, `figma-create-new-file`, `figma-generate-diagram`) — **لا تحتاج تثبيتًا** |

### ⛔ العائق الأساسي: الخطة والمقعد الحاليان لا يكفيان

من وثائق Figma الرسمية:
- «Writing to the canvas is available on Professional, Education, Organization, and Enterprise plans» — **Starter غير مذكورة**. ([Get started](https://help.figma.com/hc/en-us/articles/39216419318551-Get-started-with-the-Figma-MCP-server))
- «You need a Full seat to write to files outside your drafts.» ([FAQs](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs))
- مقاعد View/Collab: **حتى 20 استدعاء قراءة شهريًا** على كل الخطط. أدوات الكتابة معفاة، مثل `create_new_file`، ولم يُذكر `use_figma` صراحة. ([Rate limits](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/))
- ملفات فريق Starter: **3 صفحات كحد أقصى للملف**، والمسودات (Drafts) بلا حد للصفحات. ([Figma plans](https://help.figma.com/hc/en-us/articles/360040328273-Team-plans-in-Figma))
- أوضاع المتغيرات (Variable modes): الخطة Professional تسمح بحتى 10 أوضاع لكل مجموعة، وخانة Starter فارغة في جدول الخطط. نحتاج الأوضاع لتبديل AR/EN في النصوص.

**الأثر:** هيكل الصفحات الثماني، وأوضاع AR/EN، وعدد الاستدعاءات اللازمة للتصميم والتحقق، كلها غير ممكنة بشكل موثوق على الحساب الحالي.

### خيارات الحل (قرارك، وتنفيذها من جهتك)
| الخيار | التفاصيل | التوصية |
|---|---|---|
| **أ. Figma for Education (مجاني)** | التقديم عبر [figma.com/education/apply](https://www.figma.com/education/) باختيار Higher Ed، والتحقق عبر SheerID، **ويتطلب بريدًا جامعيًا**. حدود خطة Education تعادل مقاعد Full/Dev في Professional | ✅ **الموصى به**، لأنك طالب في جامعة الطائف. ملاحظة: حساب Figma المتصل مسجّل ببريد شخصي، والتحقق يشترط بريدًا جامعيًا |
| ب. الترقية إلى Professional (مدفوع) | مقعد Full | بديل إذا تعذّر التحقق |
| ج. التجربة على المسودات بالحساب الحالي | الوثائق متعارضة حول Starter، والتجربة تعني إنشاء ملف اختباري واحد في Drafts | للتشخيص فقط، وتبقى حدود الأوضاع والقراءات قائمة |

[دليل Figma for Education](https://help.figma.com/hc/en-us/articles/360041061214-Figma-for-Education)

## 2. الأدوات المقترحة (الضرورية فقط)

| # | الأداة | المصدر الرسمي | لماذا | ما الذي سيُثبَّت أو يُعدَّل |
|---|---|---|---|---|
| 1 | **Figma MCP Server (remote) + Skills الرسمية** | [developers.figma.com/docs/figma-mcp-server](https://developers.figma.com/docs/figma-mcp-server/) | إنشاء الملف والصفحات والمتغيرات والمكونات والشاشات والـPrototype (`reactions`) داخل Figma فعليًا | **لا شيء**، فهو متصل مسبقًا. التغيير الوحيد إنشاء ملف تصميم جديد في حسابك بعد موافقتك |
| 2 | **أصول الهوية الحالية** عبر `createNodeFromSvg` | ملفات `brand/assets/` | الشعارات (النصوص فيها مسارات) والأيقونات الـ21 والأنماط، دون إعادة رسم | لا شيء. تنبيه: أيقونات الهوية تستخدم `fill="var(--icon-bg,#fff)"`، وستُستبدل بلون فعلي **داخل Figma فقط** دون تعديل الملفات الأصلية |
| 3 | **Lucide Icons** لأيقونات الواجهة الناقصة فقط (بحث، تصفية، إغلاق، أسهم، تعديل، إعدادات، خروج، تحذير…) | [github.com/lucide-icons/lucide](https://github.com/lucide-icons/lucide) · ترخيص **ISC** · آخر إصدار 1.60.0 | تطابق أسلوب أيقونات الهوية تقنيًا: شبكة 24، بلا تعبئة، currentColor، أطراف مستديرة. الفرق الوحيد سمك الخط (2 مقابل 1.75) ويُضبط على 1.75 | **لا تثبيت** في المشروع: تُجلب ملفات SVG المطلوبة فقط من المستودع الرسمي وتُدرج في Figma كمكونات منفصلة عن أيقونات الهوية. *البديل:* رسمها يدويًا وفق قاعدة الدليل |
| 4 | **دعم RTL الأصلي في Figma** | [Add right-to-left text](https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text) | يدعم Figma العربية والنص ثنائي الاتجاه أصليًا، دون إضافات | لا شيء. **سأتجنّب إضافات «عكس التخطيط»** لأن بعضها يفصل المكونات (detach). تُبنى إطارات RTL وLTR منفصلة وتُراجع كلٌّ على حدة |
| 5 | **الخطوط** Tajawal وInter | ضمن خطوط Google المتاحة افتراضيًا في Figma | الالتزام بخطوط الهوية | لا شيء، وسأتحقق بـ`listAvailableFontsAsync` قبل أول نص |
| 6 | **فحص التباين** | معادلة WCAG 2.1 الرسمية | التحقق من تباين كل زوج لون/خلفية مستخدم فعليًا | سكربت Python محلي في مجلد scratchpad المؤقت (مكتبة قياسية، لا تثبيت) يقرأ `hafez-tokens.json` فقط |
| 7 | (اختياري) **FigJam عبر `generate_diagram`** | Figma MCP | مخطط آلة الحالات والتدفقات كمرجع إضافي | ملف FigJam واحد. *الأساس:* تبقى تدفقات المستخدم في صفحة `02 — User Flows` داخل ملف التصميم |

### ما لن أستخدمه
- إضافات Figma Community غير الرسمية (لا يمكن تشغيلها عبر MCP أصلًا، وبعضها يفصل المكونات).
- أدوات تحويل HTML/كود إلى Figma (`generate_figma_design` / Code Layers)، لأنها تتعارض مع شرط التصميم الأصلي في Figma.
- Canva أو Higgsfield أو غيرهما من الموصلات المتصلة، لأنها خارج نطاق التصميم المطلوب.
- **توليد صور بالذكاء الاصطناعي:** الدليل يمنع تقديمها كتوثيق حقيقي، وستستخدم التصاميم العناصر الرسومية للهوية أو مواضع صور موسومة.

## 2.5 نتيجة اختبار الكتابة الفعلي (2026-10-21)

ملف اختباري في Drafts: [Hafez — MCP Write Test](https://www.figma.com/design/1Q6IN25XtV3xKKFgAKSSCr)

| الاختبار | النتيجة |
|---|---|
| إنشاء ملف (`create_new_file`) | ✅ نجح في Drafts |
| الكتابة على اللوحة (`use_figma`) بمقعد View | ✅ نجحت داخل Drafts |
| خط Tajawal (7 أوزان) وInter | ✅ متاحان، والعربية تُعرض متصلة وصحيحة |
| نص RTL ومحاذاة يمين وAuto Layout | ✅ |
| تفاعل Prototype (نقر ← انتقال) | ✅ |
| صفحة رابعة في الملف | ❌ رسالة Figma: «The Starter plan only comes with 3 pages» |
| وضع ثانٍ للمتغيرات (AR/EN) | ❌ رسالة Figma: «Limited to 1 modes only» |

نُظّف الملف بعد الاختبار: حُذفت الصفحات المؤقتة ومجموعة المتغيرات الاختبارية، وبقي إطاران للمراجعة.

## 3. بانتظار موافقتك
1. اختيار حل الحساب (أ / ب / ج)، **وتنفيذه من جهتك** (لا أستطيع إنشاء حسابات أو التحقق نيابة عنك).
2. الموافقة على استخدام Lucide لأيقونات الواجهة الناقصة، أو رسمها يدويًا.
3. الموافقة على إنشاء ملف Figma (وملف FigJam الاختياري) بعد حل الحساب.
